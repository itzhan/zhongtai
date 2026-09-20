import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FUND_CURRENCY, FUND_KIND, isOneOf } from "@/lib/enums";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.companyFund.findUnique({ where: { id } });
  if (!existing) return notFound("记录不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    holder: string;
    name: string;
    kind: string;
    currency: string;
    amount: number;
    uncertain: boolean;
    note: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.holder !== undefined) {
    const holder = body.holder.trim();
    if (!holder) return badRequest("请填写归属");
    data.holder = holder;
  }
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return badRequest("请填写位置或对方名称");
    data.name = name;
  }
  if (body.kind !== undefined) {
    if (!isOneOf(FUND_KIND, body.kind)) return badRequest("资金类型非法");
    data.kind = body.kind;
  }
  if (body.currency !== undefined) {
    if (!isOneOf(FUND_CURRENCY, body.currency)) return badRequest("币种非法");
    data.currency = body.currency;
  }
  if (body.uncertain !== undefined) data.uncertain = Boolean(body.uncertain);
  if (body.amount !== undefined || body.uncertain === true) {
    const uncertain = body.uncertain !== undefined ? Boolean(body.uncertain) : existing.uncertain;
    if (uncertain) {
      data.amount = 0;
      data.uncertain = true;
    } else {
      const amount = Number(body.amount ?? existing.amount);
      if (!Number.isFinite(amount) || amount < 0) return badRequest("金额非法");
      data.amount = amount;
    }
  }
  if (body.note !== undefined) data.note = body.note.trim();

  const item = await prisma.companyFund.update({ where: { id }, data });
  return jsonItem("companyFund", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.companyFund.findUnique({ where: { id } });
  if (!existing) return notFound("记录不存在");

  await prisma.companyFund.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
