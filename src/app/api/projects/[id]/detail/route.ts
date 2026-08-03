import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireAuth } from "@/lib/guard";
import { maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 项目详情页一次拉完。
/// 顺序语义: 成本/收入(必有) → 台子 → 甲方需求(可选) → 产出批次(可选)
/// 未开启的可选模块返回 null, 前端不渲染。
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
  const canSeeEntries =
    isAdmin || role === ROLES.FINANCE || role === ROLES.RESOURCE || role === ROLES.SALES;
  const canSeeProduction = isAdmin || role === ROLES.PRODUCTION || role === ROLES.FINANCE;
  const canSeeDemands =
    isAdmin ||
    role === ROLES.SALES ||
    role === ROLES.FINANCE ||
    role === ROLES.PRODUCTION ||
    role === ROLES.RESOURCE;

  // 销售默认只看收入, 资源只看成本; 财务/管理员全看
  let entryKind: string | undefined;
  if (role === ROLES.SALES) entryKind = "income";
  else if (role === ROLES.RESOURCE) entryKind = "cost";

  const loadDemands = project.enableDemands && canSeeDemands;
  const loadBatches = project.enableBatches && canSeeProduction;

  const [demands, desks, entries, batches] = await Promise.all([
    loadDemands
      ? prisma.projectDemand.findMany({
          where: { projectId: id, deletedAt: null },
          include: { product: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : Promise.resolve(null),

    canSeeDesks
      ? prisma.desk.findMany({
          where: {
            projectId: id,
            deletedAt: null,
            ...(role === ROLES.SALES ? { ownerId: g.session.id } : {}),
          },
          include: {
            owner: { select: { id: true, displayName: true } },
            items: { select: { quantity: true, unitPrice: true, productName: true } },
          },
          orderBy: { id: "desc" },
        })
      : Promise.resolve(null),

    canSeeEntries
      ? prisma.financeEntry.findMany({
          where: {
            projectId: id,
            deletedAt: null,
            ...(entryKind ? { kind: entryKind } : {}),
          },
          include: {
            createdBy: { select: { id: true, displayName: true } },
          },
          orderBy: [{ entryDate: "desc" }, { id: "desc" }],
          take: 100,
        })
      : Promise.resolve(null),

    loadBatches
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
      // 成本/收入必有块: 有权限时始终返回数组(可为空)
      entries: entries ? maskMany("financeEntry", role, entries) : null,
      desks: desks ? maskMany("desk", role, desks) : null,
      demands: demands ? maskMany("demand", role, demands) : null,
      batches,
    },
  });
}
