import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.resourceBusiness.findUnique({ where: { id } });
  if (!existing) return notFound("业务分类不存在");
  const body = (await req.json().catch(() => ({}))) as { name?: string; active?: boolean };
  const data: { name?: string; active?: boolean } = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return badRequest("业务名称不能为空");
    data.name = name;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);
  const item = await prisma.resourceBusiness.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.resourceBusiness.findUnique({ where: { id } });
  if (!existing) return notFound("业务分类不存在");
  await prisma.resourceBusiness.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
