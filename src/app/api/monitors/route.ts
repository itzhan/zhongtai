import { prisma } from "@/lib/db";
import { defaultMonitorModel, isOneOf, MONITOR_KIND } from "@/lib/enums";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { scoreMonitor } from "@/lib/monitor-score";
import { ROLES } from "@/lib/rbac";
import { snapshotBoundAccount } from "@/lib/sub2-dispatch";
import { assertAccountFree, parseBinding } from "@/lib/sub2-site";

export const runtime = "nodejs";

const INCLUDE = {
  supplier: {
    select: {
      id: true,
      name: true,
      category: true,
      wechat: true,
      goodsItems: { select: { id: true, name: true, rate: true }, orderBy: { id: "asc" as const } },
    },
  },
  sub2Site: { select: { id: true, name: true, enabled: true } },
  samples: { orderBy: { checkedAt: "desc" as const }, take: 24 },
} as const;

export async function GET() {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const items = await prisma.supplierMonitor.findMany({
    include: INCLUDE,
    orderBy: [{ supplierId: "asc" }, { id: "asc" }],
  });
  return jsonItems(
    "supplierMonitor",
    g.session.role,
    items.map(({ apiKey: _apiKey, samples, ...rest }) => {
      const chronological = [...samples].reverse();
      return { ...rest, samples: chronological, score: scoreMonitor(chronological) };
    }),
  );
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    supplierId: number;
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    kind: string;
    slowMs: number;
    sub2ChannelId: number | null;
    sub2SiteId: number | null;
    sub2AccountId: number | null;
  }>;

  const supplierId = Number(body.supplierId);
  if (!Number.isInteger(supplierId) || supplierId <= 0) return badRequest("请选择供应商");
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, baseUrl: true } });
  if (!supplier) return badRequest("供应商不存在");

  const baseUrl = (body.baseUrl ?? supplier.baseUrl ?? "").trim();
  if (!baseUrl) return badRequest("请填写探测地址");
  const kind = isOneOf(MONITOR_KIND, body.kind) ? body.kind : "openai";
  const slowMs = Number(body.slowMs ?? 5000);
  if (!Number.isFinite(slowMs) || slowMs < 200) return badRequest("慢请求阈值非法");

  const binding = parseBinding(body);
  if ("error" in binding) return badRequest(binding.error);
  if (binding.sub2SiteId && binding.sub2AccountId) {
    const site = await prisma.sub2Site.findUnique({ where: { id: binding.sub2SiteId }, select: { id: true } });
    if (!site) return badRequest("调度台子不存在");
    const clash = await assertAccountFree(binding.sub2SiteId, binding.sub2AccountId);
    if (clash) return badRequest(clash);
  }

  let item;
  try {
    item = await prisma.supplierMonitor.create({
      data: {
        supplierId,
        name: (body.name ?? "").trim() || "默认",
        kind,
        baseUrl,
        apiKey: (body.apiKey ?? "").trim(),
        model: defaultMonitorModel(kind, body.model),
        slowMs,
        sub2ChannelId: body.sub2ChannelId == null ? null : Number(body.sub2ChannelId),
        sub2SiteId: binding.sub2SiteId ?? null,
        sub2AccountId: binding.sub2AccountId ?? null,
      },
      include: INCLUDE,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return badRequest("该账号已绑定其他渠道");
    throw e;
  }
  if (item.sub2SiteId && item.sub2AccountId) {
    const site = await prisma.sub2Site.findUnique({ where: { id: item.sub2SiteId } });
    if (site) await snapshotBoundAccount(site, item.id, item.sub2AccountId);
  }
  const { apiKey: _apiKey, samples, ...rest } = item;
  const chronological = [...samples].reverse();
  return jsonItem("supplierMonitor", g.session.role, {
    ...rest,
    samples: chronological,
    score: scoreMonitor(chronological),
  });
}
