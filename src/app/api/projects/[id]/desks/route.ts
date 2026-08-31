import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { DESK_INCLUDE } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("项目不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{ deskId: number; deskIds: number[] }>;
  const ids = Array.isArray(body.deskIds)
    ? body.deskIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : body.deskId
      ? [Number(body.deskId)]
      : [];
  if (!ids.length) return badRequest("请选择台子");

  const desks = await prisma.desk.findMany({
    where: {
      id: { in: ids },
      ...(g.session.role === ROLES.SALES ? { ownerId: g.session.id } : {}),
    },
    select: { id: true },
  });
  if (desks.length !== ids.length) return badRequest("部分台子不存在或无权挂入");

  await Promise.all(
    ids.map((deskId) =>
      prisma.deskProject.upsert({
        where: { deskId_projectId: { deskId, projectId } },
        update: {},
        create: { deskId, projectId },
      }),
    ),
  );

  const items = await prisma.desk.findMany({
    where: { id: { in: ids } },
    include: DESK_INCLUDE,
  });
  return NextResponse.json({ items: items.map((item) => item) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const deskId = Number(new URL(req.url).searchParams.get("deskId"));
  if (!deskId) return badRequest("请指定台子");

  const desk = await prisma.desk.findUnique({ where: { id: deskId }, select: { id: true, ownerId: true } });
  if (!desk) return notFound("台子不存在");
  if (g.session.role === ROLES.SALES && desk.ownerId !== g.session.id) {
    return badRequest("无权操作他人的台子");
  }

  await prisma.deskProject.deleteMany({ where: { deskId, projectId } });
  return jsonItem("desk", g.session.role, await prisma.desk.findUnique({ where: { id: deskId }, include: DESK_INCLUDE }));
}
