import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  forbidden,
  notFound,
  parseId,
  requireRole,
  requireRoleFresh,
} from "@/lib/guard";
import { isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { DESK_INCLUDE, validateLines } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.desk.findUnique({ where: { id }, include: DESK_INCLUDE });
  if (!item) return notFound("台子不存在");
  if (g.session.role === ROLES.SALES && item.ownerId !== g.session.id) {
    return forbidden("无权查看他人的台子");
  }

  return jsonItem("desk", g.session.role, item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.desk.findUnique({ where: { id } });
  if (!existing) return notFound("台子不存在");
  if (g.session.role === ROLES.SALES && existing.ownerId !== g.session.id) {
    return forbidden("无权修改他人的台子");
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    projectId: number;
    ownerId: number;
    contact: string;
    demand: string;
    status: string;
    notes: string;
    items: { productId: number; quantity: number; unitPrice: number; note?: string }[];
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("台子名称不能为空");
    data.name = v;
  }
  if (body.projectId !== undefined) data.projectId = Number(body.projectId);
  if (body.contact !== undefined) data.contact = body.contact;
  if (body.demand !== undefined) data.demand = body.demand;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.status !== undefined) {
    if (!isOneOf(PARTNER_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }
  // 转派归属销售只有财务/管理员能做
  if (body.ownerId !== undefined && g.session.role !== ROLES.SALES) {
    data.ownerId = Number(body.ownerId);
  }

  // 明细行整体替换: 前端是一张表格, 逐行 diff 的复杂度远超收益,
  // 而且删中间行 + 改单价这类组合用 diff 很容易出错。
  const lines = body.items === undefined ? null : validateLines(body.items);
  if (typeof lines === "string") return badRequest(lines);

  const item = await prisma.$transaction(async (tx) => {
    if (lines !== null) {
      await tx.deskItem.deleteMany({ where: { deskId: id } });
      data.items = { create: lines };
    }
    return tx.desk.update({ where: { id }, data, include: DESK_INCLUDE });
  });

  return jsonItem("desk", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.desk.findUnique({ where: { id } });
  if (!existing) return notFound("台子不存在");
  if (g.session.role === ROLES.SALES && existing.ownerId !== g.session.id) {
    return forbidden("无权删除他人的台子");
  }

  await prisma.desk.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
