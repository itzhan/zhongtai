import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { CARD_STATUS, isOneOf } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  source: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.cardResource.findUnique({ where: { id } });
  if (!existing) return notFound("卡不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    cardNo: string;
    cvv: string;
    expiry: string;
    holder: string;
    amount: number;
    usage: string;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.cardNo !== undefined) {
    const v = body.cardNo.trim();
    if (!v) return badRequest("卡号不能为空");
    data.cardNo = v;
  }
  if (body.cvv !== undefined) data.cvv = body.cvv;
  if (body.expiry !== undefined) data.expiry = body.expiry;
  if (body.holder !== undefined) data.holder = body.holder;
  if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
  if (body.usage !== undefined) data.usage = body.usage;
  if (body.sourceId !== undefined) data.sourceId = body.sourceId ?? null;
  if (body.projectId !== undefined) data.projectId = body.projectId ?? null;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.status !== undefined) {
    if (!isOneOf(CARD_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
    // 标记为已用完时顺手记录时间, 便于后续对账
    if (body.status === "used" && !existing.usedAt) data.usedAt = new Date();
  }

  const item = await prisma.cardResource.update({ where: { id }, data, include: INCLUDE });
  return jsonItem("card", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.cardResource.findUnique({ where: { id } });
  if (!existing) return notFound("卡不存在");

  await prisma.cardResource.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
