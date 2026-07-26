import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/enums";
import { ROLES } from "@/lib/rbac";
import { todayStr } from "@/lib/format";

export const runtime = "nodejs";

/// 一键据申报单生成采购记录。
/// 按【资源类型】把申报明细聚合成一笔采购 —— 一张申报单通常同时用了
/// 邮箱和 IP, 而采购记录是按类型分账的。
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const request = await prisma.resourceRequest.findUnique({
    where: { id },
    include: { items: { include: { source: { select: { id: true, name: true } } } } },
  });
  if (!request) return notFound("申报单不存在");
  if (request.status === "purchased") return badRequest("该申报已生成过采购记录");
  if (request.status === "rejected") return badRequest("已驳回的申报不能生成采购");
  if (request.items.length === 0) return badRequest("该申报没有明细");

  // 按 kind 聚合: 数量求和、金额求和、来源在同类只有一个时保留
  const byKind = new Map<
    string,
    { quantity: number; amount: number; sourceIds: Set<number>; parts: string[] }
  >();

  for (const it of request.items) {
    const acc = byKind.get(it.kind) ?? {
      quantity: 0,
      amount: 0,
      sourceIds: new Set<number>(),
      parts: [],
    };
    acc.quantity += it.quantity;
    acc.amount += it.amount;
    if (it.sourceId) acc.sourceIds.add(it.sourceId);
    acc.parts.push(`${it.source?.name ?? "未指定来源"} ×${it.quantity}`);
    byKind.set(it.kind, acc);
  }

  const today = todayStr();

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const [kind, acc] of byKind) {
      const label = RESOURCE_KIND_LABEL[kind as ResourceKind] ?? kind;
      rows.push(
        await tx.purchase.create({
          data: {
            projectId: request.projectId,
            requestId: request.id,
            kind,
            purchaserId: g.session.id,
            // 同类明细来自多个来源时不指定单一来源, 详情里已写清楚
            sourceId: acc.sourceIds.size === 1 ? [...acc.sourceIds][0] : null,
            content: `${label} ×${acc.quantity}`,
            detail: `据 ${request.periodDate} 消耗申报生成：${acc.parts.join("、")}`,
            quantity: acc.quantity,
            totalAmount: acc.amount,
            purchaseDate: today,
          },
        }),
      );
    }

    await tx.resourceRequest.update({
      where: { id: request.id },
      data: { status: "purchased", handledById: g.session.id, handledAt: new Date() },
    });

    return rows;
  });

  // 一张申报可能生成多笔采购 (每个资源类型一笔), 所以返回条数而非单个 item
  return NextResponse.json({ ok: true, count: created.length });
}
