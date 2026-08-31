import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { updateAccount } from "@/lib/sub2-client";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const site = await prisma.sub2Site.findUnique({ where: { id } });
  if (!site) return notFound("调度台子不存在");

  const body = (await req.json().catch(() => ({}))) as { monitorId?: number };
  const monitorId = Number(body.monitorId);
  if (!Number.isInteger(monitorId) || monitorId <= 0) return badRequest("请选择渠道");
  const monitor = await prisma.supplierMonitor.findUnique({ where: { id: monitorId } });
  if (!monitor || monitor.sub2SiteId !== id || monitor.sub2AccountId == null) {
    return badRequest("该渠道未绑定此台子账号");
  }
  if (monitor.originConcurrency == null) return badRequest("还没有记录到原始并发，无法重置");

  const payload: { concurrency: number; load_factor?: number; priority?: number } = {
    concurrency: monitor.originConcurrency,
  };
  if (monitor.originLoadFactor != null) payload.load_factor = monitor.originLoadFactor;
  if (monitor.originPriority != null) payload.priority = monitor.originPriority;

  const r = await updateAccount({ baseUrl: site.baseUrl, apiKey: site.apiKey }, monitor.sub2AccountId, payload);
  if (!r.ok) return badRequest(r.error);

  await prisma.sub2DispatchLog.create({
    data: {
      siteId: id,
      monitorId: monitor.id,
      accountId: monitor.sub2AccountId,
      action: "reset",
      concurrency: monitor.originConcurrency,
      detail: `重置为原始 concurrency=${monitor.originConcurrency}` +
        (monitor.originLoadFactor != null ? ` load_factor=${monitor.originLoadFactor}` : "") +
        (monitor.originPriority != null ? ` priority=${monitor.originPriority}` : ""),
      ok: true,
    },
  });
  return Response.json({ ok: true });
}
