import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { FINANCE_KIND, isOneOf } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function canWriteKind(role: string, kind: string): boolean {
  if (role === ROLES.ADMIN || role === ROLES.FINANCE) return true;
  if (role === ROLES.SALES) return kind === "income";
  if (role === ROLES.RESOURCE) return kind === "cost";
  return false;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.financeEntry.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return notFound("记录不存在");
  if (!canWriteKind(g.session.role, existing.kind)) {
    return forbidden("无权修改该类型记录");
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    kind: string;
    amount: number;
    note: string;
    entryDate: string;
  }>;

  const data: Record<string, unknown> = {};

  if (body.kind !== undefined) {
    if (!isOneOf(FINANCE_KIND, body.kind)) return badRequest("流水类型非法");
    if (!canWriteKind(g.session.role, body.kind)) return forbidden("无权改为该类型");
    data.kind = body.kind;
  }
  if (body.amount !== undefined) {
    const v = Number(body.amount);
    if (!Number.isFinite(v) || v < 0) return badRequest("金额非法");
    data.amount = v;
  }
  if (body.note !== undefined) data.note = body.note;
  if (body.entryDate !== undefined) {
    if (!DATE_RE.test(body.entryDate)) return badRequest("日期格式应为 YYYY-MM-DD");
    data.entryDate = body.entryDate;
  }

  const item = await prisma.financeEntry.update({
    where: { id },
    data,
    include: INCLUDE,
  });
  return jsonItem("financeEntry", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.financeEntry.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return notFound("记录不存在");
  if (!canWriteKind(g.session.role, existing.kind)) {
    return forbidden("无权删除该类型记录");
  }

  await prisma.financeEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
