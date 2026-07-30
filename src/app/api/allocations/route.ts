import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { ALLOCATION_INCLUDE, normalizeItems, supportsBusiness, validateAssignee, type AllocationInputItem } from "@/lib/allocation";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const items = await prisma.resourceAllocation.findMany({
    where: g.session.role === ROLES.PRODUCTION ? { assigneeId: g.session.id } : {},
    include: ALLOCATION_INCLUDE,
    orderBy: [{ allocatedAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    assigneeId?: number; projectId?: number | null; note?: string; items?: AllocationInputItem[];
  };
  const assigneeId = Number(body.assigneeId);
  if (!assigneeId || !(await validateAssignee(assigneeId))) return badRequest("请选择有效的生产人员");
  const rows = normalizeItems(body.items ?? []);
  if (!rows.length) return badRequest("请先预览并确认分配资源");

  try {
    const item = await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (row.kind === "email") {
          const email = await tx.emailResource.findUnique({ where: { id: row.emailId ?? 0 } });
          if (!email || email.status !== "available" || !supportsBusiness(email.usage, row.business)) throw new Error("预览中的邮箱已不可用或不适用于所选业务");
          const used = await tx.resourceAllocationItem.findFirst({ where: { emailId: email.id, business: row.business } });
          if (used) throw new Error(`邮箱 ${email.address} 已分配给该业务`);
        } else if (row.kind === "proxy") {
          const proxy = await tx.proxyResource.findUnique({ where: { id: row.proxyId ?? 0 } });
          if (!proxy || proxy.status !== "available") throw new Error("预览中的代理 IP 已不可用");
        } else {
          const card = await tx.cardResource.findUnique({ where: { id: row.cardId ?? 0 } });
          if (!card || card.amount < row.amount || row.amount <= 0 || !supportsBusiness(card.usage, row.business)) throw new Error("预览中的卡余额不足或不适用于所选业务");
          await tx.cardResource.update({ where: { id: card.id }, data: { amount: { decrement: row.amount }, ...(card.amount === row.amount ? { status: "used", usedAt: new Date() } : {}) } });
        }
      }
      return tx.resourceAllocation.create({
        data: { assigneeId, allocatorId: g.session.id, projectId: body.projectId ? Number(body.projectId) : null, note: body.note ?? "", items: { create: rows } },
        include: ALLOCATION_INCLUDE,
      });
    });
    return NextResponse.json({ item });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "分配失败");
  }
}
