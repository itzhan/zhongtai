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
import { isOneOf, RESOURCE_KIND } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  items: { include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
  project: { select: { id: true, code: true, name: true } },
  reporter: { select: { id: true, displayName: true } },
  handledBy: { select: { id: true, displayName: true } },
  purchases: { select: { id: true, totalAmount: true } },
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.PRODUCTION, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.resourceRequest.findUnique({ where: { id }, include: INCLUDE });
  if (!item) return notFound("申报单不存在");
  if (g.session.role === ROLES.PRODUCTION && item.reporterId !== g.session.id) {
    return forbidden("无权查看他人的申报");
  }

  return jsonItem("request", g.session.role, item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.resourceRequest.findUnique({ where: { id } });
  if (!existing) return notFound("申报单不存在");

  // 生产只能改自己的、且只在待处理阶段能改 —— 已确认/已采购的单子是
  // 财务凭证, 改了会让采购记录对不上。
  if (g.session.role === ROLES.PRODUCTION) {
    if (existing.reporterId !== g.session.id) return forbidden("无权修改他人的申报");
    if (existing.status !== "pending") return badRequest("已处理的申报不能再修改");
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    projectId: number;
    periodDate: string;
    note: string;
    items: { kind: string; sourceId: number | null; quantity: number; amount: number; note?: string }[];
  }>;

  const data: Record<string, unknown> = {};
  if (body.projectId !== undefined) data.projectId = Number(body.projectId);
  if (body.periodDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodDate)) return badRequest("日期格式应为 YYYY-MM-DD");
    data.periodDate = body.periodDate;
  }
  if (body.note !== undefined) data.note = body.note;

  if (body.items !== undefined) {
    for (let i = 0; i < body.items.length; i++) {
      const l = body.items[i];
      if (!isOneOf(RESOURCE_KIND, l.kind)) return badRequest(`第 ${i + 1} 行资源类型非法`);
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty <= 0) return badRequest(`第 ${i + 1} 行数量需为正整数`);
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    if (body.items !== undefined) {
      await tx.resourceRequestItem.deleteMany({ where: { requestId: id } });
      data.items = {
        create: body.items.map((l) => ({
          kind: l.kind,
          sourceId: l.sourceId ?? null,
          quantity: Number(l.quantity),
          amount: Number(l.amount) || 0,
          note: l.note ?? "",
        })),
      };
    }
    return tx.resourceRequest.update({ where: { id }, data, include: INCLUDE });
  });

  return jsonItem("request", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.resourceRequest.findUnique({ where: { id } });
  if (!existing) return notFound("申报单不存在");
  if (g.session.role === ROLES.PRODUCTION) {
    if (existing.reporterId !== g.session.id) return forbidden("无权删除他人的申报");
    if (existing.status !== "pending") return badRequest("已处理的申报不能删除");
  }

  await prisma.resourceRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
