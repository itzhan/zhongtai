import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; goodId: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const params = await ctx.params;
  const supplierId = parseId(params.id);
  const goodId = parseId(params.goodId);
  if (!supplierId || !goodId) return badRequest("id 非法");

  const existing = await prisma.supplierGood.findFirst({ where: { id: goodId, supplierId } });
  if (!existing) return notFound("货不存在");

  await prisma.supplierGood.delete({ where: { id: goodId } });
  return NextResponse.json({ ok: true });
}
