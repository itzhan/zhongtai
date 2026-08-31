import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSupplierCategories, serializeSupplierCategories } from "@/lib/enums";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { SUPPLIER_DETAIL_INCLUDE, SUPPLIER_INCLUDE } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.supplier.findUnique({ where: { id }, include: SUPPLIER_DETAIL_INCLUDE });
  if (!item) return notFound("供应商不存在");

  const spent = item.entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  return jsonItem("supplier", g.session.role, { ...item, spent });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return notFound("供应商不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    wechat: string;
    contact: string;
    baseUrl: string;
    goods: string;
    category: string | string[];
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("供应商名称不能为空");
    data.name = v;
  }
  if (body.wechat !== undefined) data.wechat = body.wechat.trim();
  if (body.contact !== undefined) data.contact = body.contact.trim();
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl.trim();
  if (body.goods !== undefined) data.goods = body.goods.trim();
  if (body.category !== undefined) {
    const categories = parseSupplierCategories(body.category);
    if (!categories.length) return badRequest("请选择业务分类");
    data.category = serializeSupplierCategories(categories);
  }

  const item = await prisma.supplier.update({ where: { id }, data, include: SUPPLIER_INCLUDE });
  return jsonItem("supplier", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return notFound("供应商不存在");

  await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
