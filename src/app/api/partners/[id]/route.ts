import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const item = await prisma.partner.findUnique({ where: { id } });
  if (!item) return notFound("合作伙伴不存在");
  return jsonItem("partner", g.session.role, item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) return notFound("合作伙伴不存在");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest("名称不能为空");
    data.name = name;
  }
  if (body.contact !== undefined) data.contact = String(body.contact).trim();
  if (body.note !== undefined) data.note = String(body.note).trim();
  const item = await prisma.partner.update({ where: { id }, data });
  return jsonItem("partner", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) return notFound("合作伙伴不存在");
  await prisma.partner.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
