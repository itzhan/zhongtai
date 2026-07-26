import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = { project: { select: { id: true, code: true, name: true } } } as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return notFound("产品不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    status: string;
    capacity: string;
    projectId: number | null;
    notes: string;
    sortOrder: number;
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("产品名称不能为空");
    data.name = v;
  }
  if (body.status !== undefined) data.status = body.status.trim() || null;
  if (body.capacity !== undefined) data.capacity = body.capacity.trim() || null;
  if (body.projectId !== undefined) data.projectId = body.projectId ?? null;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  const item = await prisma.product.update({ where: { id }, data, include: INCLUDE });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { deskItems: true, supplierItems: true, batches: true } } },
  });
  if (!existing) return notFound("产品不存在");

  const c = existing._count;
  if (c.deskItems || c.supplierItems || c.batches) {
    return badRequest(
      `该产品已被 ${c.deskItems} 条台子明细 / ${c.supplierItems} 条供货明细 / ${c.batches} 条产出批次引用，无法删除`,
    );
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
