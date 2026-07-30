import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireAuth } from "@/lib/guard";
import { maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 项目详情页的四张明细表一次拉完。每张表按当前角色脱敏, 并且角色看不到
/// 的整块直接不返回 —— 销售拿到的响应体里根本没有 purchases。
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const project = await prisma.project.findUnique({
    where: { id },
    include: { owner: { select: { id: true, displayName: true } } },
  });
  if (!project) return notFound("项目不存在");

  const role = g.session.role;
  const isAdmin = role === ROLES.ADMIN;
  const canSeeDesks = isAdmin || role === ROLES.SALES || role === ROLES.FINANCE;
  const canSeeCost = isAdmin || role === ROLES.FINANCE || role === ROLES.RESOURCE;
  const canSeeProduction = isAdmin || role === ROLES.PRODUCTION || role === ROLES.FINANCE;

  const [desks, purchases, batches] = await Promise.all([
    canSeeDesks
      ? prisma.desk.findMany({
          where: {
            projectId: id,
            // 销售在这里同样只看自己的台子
            ...(role === ROLES.SALES ? { ownerId: g.session.id } : {}),
          },
          include: {
            owner: { select: { id: true, displayName: true } },
            items: { select: { quantity: true, unitPrice: true } },
          },
          orderBy: { id: "desc" },
        })
      : Promise.resolve(null),

    canSeeCost
      ? prisma.purchase.findMany({
          where: { projectId: id },
          include: { purchaser: { select: { id: true, displayName: true } } },
          orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
          take: 50,
        })
      : Promise.resolve(null),

    canSeeProduction
      ? prisma.productionBatch.findMany({
          where: { projectId: id },
          include: {
            product: { select: { id: true, name: true } },
            operator: { select: { id: true, displayName: true } },
          },
          orderBy: [{ batchDate: "desc" }, { id: "desc" }],
          take: 50,
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    item: {
      project,
      desks: desks ? maskMany("desk", role, desks) : null,
      purchases: purchases ? maskMany("purchase", role, purchases) : null,
      batches,
    },
  });
}
