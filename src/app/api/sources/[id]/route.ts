import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  _count: { select: { cards: true, proxies: true, emails: true } },
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.resourceSource.findUnique({ where: { id } });
  if (!existing) return notFound("来源不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    channel: string;
    kinds: string[];
    contact: string;
    emailPrice: number;
    proxyPrice: number;
    cardPrice: number;
    priceInfo: string;
    active: boolean;
    notes: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = body.name.trim();
    if (!v) return badRequest("来源名称不能为空");
    data.name = v;
  }
  if (body.channel !== undefined) data.channel = body.channel;
  if (body.kinds !== undefined) data.kinds = body.kinds.join(",");
  if (body.contact !== undefined) data.contact = body.contact;
  if (body.emailPrice !== undefined) data.emailPrice = Number(body.emailPrice) || 0;
  if (body.proxyPrice !== undefined) data.proxyPrice = Number(body.proxyPrice) || 0;
  if (body.cardPrice !== undefined) data.cardPrice = Number(body.cardPrice) || 0;
  if (body.priceInfo !== undefined) data.priceInfo = body.priceInfo;
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.notes !== undefined) data.notes = body.notes;

  const item = await prisma.resourceSource.update({ where: { id }, data, include: INCLUDE });
  return jsonItem("source", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.resourceSource.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return notFound("来源不存在");

  const c = existing._count;
  if (c.cards || c.proxies || c.emails) {
    return badRequest(
      `该来源下还有 ${c.cards} 张卡 / ${c.proxies} 个代理 / ${c.emails} 个邮箱，无法删除。可改为「停用」`,
    );
  }

  await prisma.resourceSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
