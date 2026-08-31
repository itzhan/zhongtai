import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { defaultMonitorModel, isOneOf, MONITOR_KIND } from "@/lib/enums";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";
import { syncSub2Channel } from "@/lib/sub2-channel";
import { snapshotBoundAccount } from "@/lib/sub2-dispatch";
import { assertAccountFree, parseBinding } from "@/lib/sub2-site";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.supplierMonitor.findUnique({ where: { id } });
  if (!existing) return notFound("监测项不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    kind: string;
    slowMs: number;
    enabled: boolean;
    sub2ChannelId: number | null;
    sub2SiteId: number | null;
    sub2AccountId: number | null;
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim() || "默认";
  if (body.baseUrl !== undefined) {
    const v = body.baseUrl.trim();
    if (!v) return badRequest("请填写探测地址");
    data.baseUrl = v;
  }
  if (body.apiKey !== undefined && body.apiKey.trim()) data.apiKey = body.apiKey.trim();
  if (body.kind !== undefined) {
    if (!isOneOf(MONITOR_KIND, body.kind)) return badRequest("请选择探测格式");
    data.kind = body.kind;
    if (body.model === undefined) data.model = defaultMonitorModel(body.kind, existing.model);
  }
  if (body.model !== undefined) {
    const kind = isOneOf(MONITOR_KIND, body.kind) ? body.kind : isOneOf(MONITOR_KIND, existing.kind) ? existing.kind : "openai";
    data.model = defaultMonitorModel(kind, body.model);
  }
  if (body.slowMs !== undefined) {
    const n = Number(body.slowMs);
    if (!Number.isFinite(n) || n < 200) return badRequest("慢请求阈值非法");
    data.slowMs = n;
  }
  if (body.sub2ChannelId !== undefined) {
    data.sub2ChannelId = body.sub2ChannelId == null ? null : Number(body.sub2ChannelId);
  }
  const binding = parseBinding(body, existing);
  if ("error" in binding) return badRequest(binding.error);
  if (binding.sub2SiteId !== undefined) {
    if (binding.sub2SiteId && binding.sub2AccountId) {
      const site = await prisma.sub2Site.findUnique({ where: { id: binding.sub2SiteId }, select: { id: true } });
      if (!site) return badRequest("调度台子不存在");
      const clash = await assertAccountFree(binding.sub2SiteId, binding.sub2AccountId, id);
      if (clash) return badRequest(clash);
    }
    data.sub2SiteId = binding.sub2SiteId;
    data.sub2AccountId = binding.sub2AccountId;
  }
  if (body.enabled !== undefined) {
    data.enabled = Boolean(body.enabled);
    const sync = await syncSub2Channel({
      sub2SiteId: (data.sub2SiteId as number | null | undefined) ?? existing.sub2SiteId,
      sub2AccountId: (data.sub2AccountId as number | null | undefined) ?? existing.sub2AccountId,
      enabled: Boolean(body.enabled),
    });
    if (!sync.ok) return badRequest(sync.error);
  }

  let item;
  try {
    item = await prisma.supplierMonitor.update({
      where: { id },
      data,
      include: {
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
      },
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return badRequest("该账号已绑定其他渠道");
    throw e;
  }
  if (item.sub2SiteId && item.sub2AccountId && item.sub2AccountId !== existing.sub2AccountId) {
    const site = await prisma.sub2Site.findUnique({ where: { id: item.sub2SiteId } });
    if (site) await snapshotBoundAccount(site, item.id, item.sub2AccountId);
  }
  const { apiKey: _apiKey, ...rest } = item;
  return jsonItem("supplierMonitor", g.session.role, rest);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.supplierMonitor.findUnique({ where: { id } });
  if (!existing) return notFound("监测项不存在");
  await prisma.supplierMonitor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
