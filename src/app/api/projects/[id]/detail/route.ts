import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireAuth } from "@/lib/guard";
import { maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return notFound("项目不存在");

  const role = g.session.role;
  const isAdmin = role === ROLES.ADMIN;
  const canSeeDesks = isAdmin || role === ROLES.SALES || role === ROLES.FINANCE;
  const canSeeEntries =
    isAdmin || role === ROLES.FINANCE || role === ROLES.RESOURCE || role === ROLES.SALES;
  const canSeeDemands =
    isAdmin ||
    role === ROLES.SALES ||
    role === ROLES.FINANCE ||
    role === ROLES.PRODUCTION ||
    role === ROLES.RESOURCE;

  const entryKindWhere =
    role === ROLES.SALES
      ? { kind: { in: ["income", "receivable"] } }
      : role === ROLES.RESOURCE
        ? { kind: "cost" }
        : {};

  const [demands, desks, entries] = await Promise.all([
    canSeeDemands
      ? prisma.projectDemand.findMany({
          where: { projectId: id, deletedAt: null },
          include: { product: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : Promise.resolve(null),

    canSeeDesks && project.enableDesks
      ? prisma.desk.findMany({
          where: {
            deletedAt: null,
            projects: { some: { projectId: id } },
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
            ...entryKindWhere,
          },
          include: {
            createdBy: { select: { id: true, displayName: true } },
            supplier: { select: { id: true, name: true } },
          },
          orderBy: [{ entryDate: "desc" }, { id: "desc" }],
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    item: {
      project,
      entries: entries ? maskMany("financeEntry", role, entries) : null,
      desks: desks ? maskMany("desk", role, desks) : null,
      demands: demands ? maskMany("demand", role, demands) : null,
    },
  });
}
