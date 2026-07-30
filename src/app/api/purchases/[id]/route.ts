import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PURCHASE_KIND } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  purchaser: { select: { id: true, displayName: true } },
  source: { select: { id: true, name: true } },
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) return notFound("采购记录不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    kind: string;
    content: string;
    detail: string;
    totalAmount: number;
    purchaseDate: string;
    sourceId: number | null;
    purchaserId: number;
    purchaserName: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.kind !== undefined) {
    if (!isOneOf(PURCHASE_KIND, body.kind)) return badRequest("采购类型非法");
    data.kind = body.kind;
  }
  if (body.content !== undefined) {
    const v = body.content.trim();
    if (!v) return badRequest("采购内容不能为空");
    data.content = v;
  }
  if (body.detail !== undefined) data.detail = body.detail;
  if (body.totalAmount !== undefined) {
    const v = Number(body.totalAmount);
    if (!Number.isFinite(v) || v < 0) return badRequest("总金额非法");
    data.totalAmount = v;
  }
  if (body.purchaseDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate)) return badRequest("日期格式应为 YYYY-MM-DD");
    data.purchaseDate = body.purchaseDate;
  }
  if (body.sourceId !== undefined) data.sourceId = body.sourceId ?? null;
  if (body.purchaserName !== undefined) {
    const purchaserName = body.purchaserName.trim();
    if (!purchaserName) return badRequest("采购人不能为空");
    data.purchaserName = purchaserName;
  }
  if (body.purchaserId !== undefined) {
    const purchaserId = Number(body.purchaserId);
    if (!purchaserId || !(await prisma.user.findFirst({ where: { id: purchaserId, active: true }, select: { id: true } }))) {
      return badRequest("请选择有效的采购人");
    }
    data.purchaserId = purchaserId;
  }

  const item = await prisma.purchase.update({ where: { id }, data, include: INCLUDE });
  return jsonItem("purchase", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) return notFound("采购记录不存在");

  await prisma.purchase.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
