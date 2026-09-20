import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireAdminFresh, requireAuth } from "@/lib/guard";
import { isOneOf, PROJECT_STATUS } from "@/lib/enums";

export const runtime = "nodejs";

const INCLUDE = {
  _count: { select: { deskLinks: true, products: true, purchases: true } },
} as const;

function shape(item: { _count: { deskLinks: number; products: number; purchases: number } }) {
  return {
    ...item,
    _count: { desks: item._count.deskLinks, products: item._count.products, purchases: item._count.purchases },
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.project.findUnique({ where: { id }, include: INCLUDE });
  if (!item) return notFound("项目不存在");
  return NextResponse.json({ item: shape(item) });
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
    description: string;
    enableDemands: boolean;
    enableBatches: boolean;
    enableDesks: boolean;
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
  if (body.description !== undefined) data.description = body.description;
  if (body.enableDemands !== undefined) data.enableDemands = Boolean(body.enableDemands);
  if (body.enableBatches !== undefined) data.enableBatches = Boolean(body.enableBatches);
  if (body.enableDesks !== undefined) data.enableDesks = Boolean(body.enableDesks);

  const item = await prisma.project.update({ where: { id }, data, include: INCLUDE });
  return NextResponse.json({ item: shape(item) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { deskLinks: true, purchases: true } } },
  });
  if (!existing) return notFound("项目不存在");

  const c = existing._count;
  if (c.deskLinks || c.purchases) {
    return badRequest(
      `该项目下还有 ${c.deskLinks} 个台子 / ${c.purchases} 笔采购，无法删除。可改为「已结束」`,
    );
  }

  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
