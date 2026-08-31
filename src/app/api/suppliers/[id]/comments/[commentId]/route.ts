import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const params = await ctx.params;
  const supplierId = parseId(params.id);
  const commentId = parseId(params.commentId);
  if (!supplierId || !commentId) return badRequest("id 非法");

  const existing = await prisma.supplierComment.findFirst({ where: { id: commentId, supplierId } });
  if (!existing) return notFound("评论不存在");

  await prisma.supplierComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
