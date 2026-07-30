import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireAdminFresh, requireAuth } from "@/lib/guard";
import { isOneOf, PROJECT_STATUS } from "@/lib/enums";

export const runtime = "nodejs";

const INCLUDE = {
  owner: { select: { id: true, displayName: true } },
  _count: { select: { desks: true, products: true, purchases: true } },
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.project.findUnique({ where: { id }, include: INCLUDE });
  if (!item) return notFound("项目不存在");
  return NextResponse.json({ item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFound("项目不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    code: string;
    name: string;
    status: string;
    ownerId: number | null;
    ownerName: string;
    description: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.code !== undefined) {
    const v = body.code.trim();
    if (!v) return badRequest("项目代号不能为空");
    if (v !== existing.code) {
      const dup = await prisma.project.findUnique({ where: { code: v } });
      if (dup) return NextResponse.json({ error: "项目代号已存在" }, { status: 409 });
    }
    data.code = v;
  }
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("项目名称不能为空");
    data.name = v;
  }
  if (body.status !== undefined) {
    if (!isOneOf(PROJECT_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }
  if (body.ownerId !== undefined) data.ownerId = body.ownerId ?? null;
  if (body.ownerName !== undefined) data.ownerName = body.ownerName.trim();
  if (body.description !== undefined) data.description = body.description;

  const item = await prisma.project.update({ where: { id }, data, include: INCLUDE });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { desks: true, purchases: true, suppliers: true } } },
  });
  if (!existing) return notFound("项目不存在");

  // 台子/供货方/采购是 Cascade, 删项目会连带删掉一大片业务数据。
  // 有关联时一律拒绝, 让用户先处理干净或改成「已结束」。
  const c = existing._count;
  if (c.desks || c.purchases || c.suppliers) {
    return badRequest(
      `该项目下还有 ${c.desks} 个台子 / ${c.suppliers} 个供货方 / ${c.purchases} 笔采购，无法删除。可改为「已结束」`,
    );
  }

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
