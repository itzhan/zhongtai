import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { runAndStore } from "@/lib/supplier-probe";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.supplierMonitor.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return notFound("监测项不存在");

  const item = await runAndStore(id);
  const { apiKey: _apiKey, ...rest } = item;
  return jsonItem("supplierMonitor", g.session.role, rest);
}
