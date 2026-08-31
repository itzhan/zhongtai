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
import { DESK_API_KIND, isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { DESK_INCLUDE, parseProjectIds, replaceDeskProjects, resolveLines } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const item = await prisma.desk.findUnique({ where: { id }, include: DESK_INCLUDE });
  if (!item) return notFound("需求不存在");
  if (g.session.role === ROLES.SALES && item.ownerId !== g.session.id) {
    return forbidden("无权查看他人的需求");
  }

  return jsonItem("desk", g.session.role, item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.desk.findUnique({
    where: { id },
    include: { projects: { select: { projectId: true } } },
  });
  if (!existing) return notFound("需求不存在");
  if (g.session.role === ROLES.SALES && existing.ownerId !== g.session.id) {
    return forbidden("无权修改他人的需求");
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    projectId: number;
    projectIds: number[];
    ownerName: string;
    contact: string;
    demand: string;
    status: string;
    notes: string;
    baseUrl: string;
    apiKind: string;
    apiToken: string;
    items: { productName: string; unitPrice: number; note?: string }[];
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("需求名称不能为空");
    data.name = v;
  }
  if (body.ownerName !== undefined) data.ownerName = body.ownerName.trim();
  if (body.contact !== undefined) data.contact = body.contact;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl.trim();
  if (body.apiKind !== undefined) {
    if (!isOneOf(DESK_API_KIND, body.apiKind)) return badRequest("API 类型非法");
    data.apiKind = body.apiKind;
  }
  if (body.apiToken !== undefined) data.apiToken = body.apiToken;
  if (body.demand !== undefined) data.demand = body.demand;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.status !== undefined) {
    if (!isOneOf(PARTNER_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }
  const syncProjects = body.projectIds !== undefined || body.projectId !== undefined;
  const projectIds = syncProjects
    ? parseProjectIds(body.projectIds, body.projectId ?? null)
    : existing.projects.map((item) => item.projectId);

  if (syncProjects && projectIds.length) {
    const count = await prisma.project.count({ where: { id: { in: projectIds } } });
    if (count !== projectIds.length) return badRequest("部分项目不存在");
  }

  const item = await prisma.$transaction(async (tx) => {
    const lines = body.items === undefined ? null : await resolveLines(tx, body.items, projectIds[0] ?? null);
    if (typeof lines === "string") throw new Error(lines);
    if (lines !== null) {
      await tx.deskItem.deleteMany({ where: { deskId: id } });
      data.items = { create: lines.map(({ apiKey: _apiKey, ...line }) => line) };
    }
    if (syncProjects) await replaceDeskProjects(tx, id, projectIds);
    return tx.desk.update({ where: { id }, data, include: DESK_INCLUDE });
  });

  return jsonItem("desk", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.desk.findUnique({ where: { id } });
  if (!existing) return notFound("需求不存在");
  if (g.session.role === ROLES.SALES && existing.ownerId !== g.session.id) {
    return forbidden("无权删除他人的需求");
  }

  await prisma.desk.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
