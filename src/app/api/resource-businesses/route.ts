import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const items = await prisma.resourceBusiness.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写业务名称");
  const exists = await prisma.resourceBusiness.findUnique({ where: { name } });
  if (exists) return badRequest("该业务已存在");
  const max = await prisma.resourceBusiness.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.resourceBusiness.create({
    data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ item });
}
