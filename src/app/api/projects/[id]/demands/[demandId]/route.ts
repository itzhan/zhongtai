import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  product: { select: { id: true, name: true } },
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; demandId: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const params = await ctx.params;
  const projectId = parseId(params.id);
  const demandId = parseId(params.demandId);
  if (!projectId || !demandId) return badRequest("id 非法");

  const existing = await prisma.projectDemand.findFirst({
    where: { id: demandId, projectId, deletedAt: null },
  });
  if (!existing) return notFound("需求不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    productId: number | null;
    productName: string;
    spec: string;
    quantity: number | null;
    note: string;
    sortOrder: number;
  }>;

  const data: Record<string, unknown> = {};

  if (body.productId !== undefined) {
    if (body.productId === null) {
      data.productId = null;
    } else {
      const product = await prisma.product.findUnique({
        where: { id: Number(body.productId) },
        select: { id: true, name: true },
      });
      if (!product) return badRequest("产品不存在");
      data.productId = product.id;
      if (body.productName === undefined) data.productName = product.name;
    }
  }

  if (body.productName !== undefined) {
    const v = body.productName.trim();
    if (!v) return badRequest("货名不能为空");
    data.productName = v;
  }
  if (body.spec !== undefined) data.spec = body.spec;
  if (body.note !== undefined) data.note = body.note;
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) return badRequest("排序非法");
    data.sortOrder = n;
  }
  if (body.quantity !== undefined) {
    if (body.quantity === null) {
      data.quantity = null;
    } else {
      const q = Number(body.quantity);
      if (!Number.isFinite(q) || q < 0) return badRequest("数量非法");
      data.quantity = q;
    }
  }

  const item = await prisma.projectDemand.update({
    where: { id: demandId },
    data,
    include: INCLUDE,
  });
  return jsonItem("demand", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; demandId: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const params = await ctx.params;
  const projectId = parseId(params.id);
  const demandId = parseId(params.demandId);
  if (!projectId || !demandId) return badRequest("id 非法");

  const existing = await prisma.projectDemand.findFirst({
    where: { id: demandId, projectId, deletedAt: null },
  });
  if (!existing) return notFound("需求不存在");

  await prisma.projectDemand.update({
    where: { id: demandId },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
