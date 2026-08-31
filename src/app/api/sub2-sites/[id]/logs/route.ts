import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const site = await prisma.sub2Site.findUnique({ where: { id }, select: { id: true } });
  if (!site) return notFound("调度台子不存在");
  const items = await prisma.sub2DispatchLog.findMany({
    where: { siteId: id },
    include: { monitor: { select: { id: true, name: true, supplier: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return jsonItems("sub2DispatchLog", g.session.role, items);
}
