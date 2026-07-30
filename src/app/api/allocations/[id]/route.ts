import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { ALLOCATION_INCLUDE, normalizeItems, supportsBusiness, validateAssignee, type AllocationInputItem } from "@/lib/allocation";

export const runtime = "nodejs";

async function restoreCards(tx: Prisma.TransactionClient, allocationId: number) {
  const rows = await tx.resourceAllocationItem.findMany({ where: { allocationId, kind: "card", cardId: { not: null } } });
  for (const row of rows) await tx.cardResource.update({ where: { id: row.cardId! }, data: { amount: { increment: row.amount }, status: "available", usedAt: null } });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.resourceAllocation.findUnique({ where: { id } });
  if (!existing) return notFound("分配记录不存在");
  const body = (await req.json().catch(() => ({}))) as { assigneeId?: number; projectId?: number | null; note?: string; items?: AllocationInputItem[] };
  const assigneeId = Number(body.assigneeId);
  if (!assigneeId || !(await validateAssignee(assigneeId))) return badRequest("请选择有效的生产人员");
  const rows = normalizeItems(body.items ?? []);
  if (!rows.length) return badRequest("请先预览并确认分配资源");

  try {
    const item = await prisma.$transaction(async (tx) => {
      await restoreCards(tx, id);
      await tx.resourceAllocationItem.deleteMany({ where: { allocationId: id } });
      for (const row of rows) {
        if (row.kind === "email") {
          const email = await tx.emailResource.findUnique({ where: { id: row.emailId ?? 0 } });
          if (!email || email.status !== "available") throw new Error("邮箱已不可用");
          if (!supportsBusiness(email.usage, row.business)) throw new Error(`邮箱 ${email.address} 不适用于 ${row.business || "所选业务"}`);
          const used = await tx.resourceAllocationItem.findFirst({ where: { emailId: email.id, business: row.business } });
          if (used) throw new Error(`邮箱 ${email.address} 已分配给该业务`);
        } else if (row.kind === "proxy") {
          const proxy = await tx.proxyResource.findUnique({ where: { id: row.proxyId ?? 0 } });
          if (!proxy || proxy.status !== "available") throw new Error("代理 IP 已不可用");
        } else {
          const card = await tx.cardResource.findUnique({ where: { id: row.cardId ?? 0 } });
          if (!card || card.amount < row.amount || row.amount <= 0 || !supportsBusiness(card.usage, row.business)) throw new Error("卡余额不足或不适用于所选业务");
          await tx.cardResource.update({ where: { id: card.id }, data: { amount: { decrement: row.amount }, ...(card.amount === row.amount ? { status: "used", usedAt: new Date() } : {}) } });
        }
      }
      return tx.resourceAllocation.update({ where: { id }, data: { assigneeId, projectId: body.projectId ? Number(body.projectId) : null, note: body.note ?? "", items: { create: rows } }, include: ALLOCATION_INCLUDE });
    });
    return NextResponse.json({ item });
  } catch (e) { return badRequest(e instanceof Error ? e.message : "更新失败"); }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.resourceAllocation.findUnique({ where: { id } });
  if (!existing) return notFound("分配记录不存在");
  await prisma.$transaction(async (tx) => { await restoreCards(tx, id); await tx.resourceAllocation.update({ where: { id }, data: { deletedAt: new Date() } }); });
  return NextResponse.json({ ok: true });
}
