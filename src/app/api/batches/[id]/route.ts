import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { BATCH_STATUS, isOneOf } from "@/lib/enums";

export const runtime = "nodejs";

const INCLUDE = {
  product: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  operator: { select: { id: true, displayName: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.productionBatch.findUnique({ where: { id } });
  if (!existing) return notFound("批次不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    projectId: number;
    productId: number;
    quantity: number;
    batchDate: string;
    note: string;
    resultData: string;
    status: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.projectId !== undefined) data.projectId = Number(body.projectId);
  if (body.productId !== undefined) data.productId = Number(body.productId);
  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isFinite(q) || q <= 0) return badRequest("产出数量需大于 0");
    data.quantity = q;
  }
  if (body.batchDate !== undefined) {
    if (!DATE_RE.test(body.batchDate)) return badRequest("生产日期格式应为 YYYY-MM-DD");
    data.batchDate = body.batchDate;
  }
  if (body.note !== undefined) data.note = body.note;
  if (body.resultData !== undefined) data.resultData = body.resultData;
  if (body.status !== undefined) {
    if (!isOneOf(BATCH_STATUS, body.status)) return badRequest("批次状态非法");
    data.status = body.status;
  }

  const item = await prisma.productionBatch.update({ where: { id }, data, include: INCLUDE });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.productionBatch.findUnique({ where: { id } });
  if (!existing) return notFound("批次不存在");

  await prisma.productionBatch.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
