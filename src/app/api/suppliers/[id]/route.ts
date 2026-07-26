import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { SUPPLIER_INCLUDE, validateLines } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.supplier.findUnique({ where: { id }, include: SUPPLIER_INCLUDE });
  if (!item) return notFound("供货方不存在");
  return jsonItem("supplier", g.session.role, item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return notFound("供货方不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    projectId: number;
    ownerId: number | null;
    contact: string;
    channel: string;
    status: string;
    notes: string;
    items: { productId: number; quantity: number; unitPrice: number; note?: string }[];
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("供货方名称不能为空");
    data.name = v;
  }
  if (body.projectId !== undefined) data.projectId = Number(body.projectId);
  if (body.ownerId !== undefined) data.ownerId = body.ownerId ?? null;
  if (body.contact !== undefined) data.contact = body.contact;
  if (body.channel !== undefined) data.channel = body.channel;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.status !== undefined) {
    if (!isOneOf(PARTNER_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }

  const lines = body.items === undefined ? null : validateLines(body.items);
  if (typeof lines === "string") return badRequest(lines);

  const item = await prisma.$transaction(async (tx) => {
    if (lines !== null) {
      await tx.supplierItem.deleteMany({ where: { supplierId: id } });
      data.items = { create: lines };
    }
    return tx.supplier.update({ where: { id }, data, include: SUPPLIER_INCLUDE });
  });

  return jsonItem("supplier", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return notFound("供货方不存在");

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
