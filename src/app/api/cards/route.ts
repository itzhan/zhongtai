import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, RESOURCE_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  source: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

/// 卡号 / CVV 只有资源管理员看得到明文, 财务能看金额但看不到卡号
/// (见 src/lib/mask.ts)。生产在页面级就被挡了。
export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status");
  const sourceId = sp.get("sourceId");

  const items = await prisma.cardResource.findMany({
    where: {
      ...(q ? { OR: [{ cardNo: { contains: q } }, { usage: { contains: q } }] } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(sourceId && sourceId !== "all" ? { sourceId: Number(sourceId) } : {}),
    },
    include: INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("card", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    /// 单条录入
    cardNo: string;
    cvv: string;
    expiry: string;
    holder: string;
    amount: number;
    usage: string;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
    /// 批量录入 —— 与单条二选一
    bulk: { cardNo: string; expiry: string; cvv: string; amount: number }[];
  }>;

  if (body.status !== undefined && !isOneOf(RESOURCE_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const common = {
    sourceId: body.sourceId ?? null,
    projectId: body.projectId ?? null,
    usage: body.usage ?? "",
    status: body.status ?? "available",
    notes: body.notes ?? "",
  };

  // 批量: 一次事务全进, 有一条不合法就整批拒绝 —— 部分成功会让用户
  // 不知道该重贴哪几行。
  if (body.bulk?.length) {
    const rows = body.bulk.map((r) => ({
      ...common,
      cardNo: (r.cardNo ?? "").trim(),
      expiry: (r.expiry ?? "").trim(),
      cvv: (r.cvv ?? "").trim(),
      amount: Number(r.amount) || 0,
      holder: "",
    }));
    const bad = rows.findIndex((r) => !r.cardNo);
    if (bad >= 0) return badRequest(`第 ${bad + 1} 条缺少卡号`);

    await prisma.cardResource.createMany({ data: rows });
    return Response.json({ ok: true, count: rows.length });
  }

  const cardNo = (body.cardNo ?? "").trim();
  if (!cardNo) return badRequest("请填写卡号");

  const item = await prisma.cardResource.create({
    data: {
      ...common,
      cardNo,
      cvv: body.cvv ?? "",
      expiry: body.expiry ?? "",
      holder: body.holder ?? "",
      amount: Number(body.amount) || 0,
    },
    include: INCLUDE,
  });

  return jsonItem("card", g.session.role, item);
}
