import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";
import { publicSite } from "@/lib/sub2-client";
import { parseSiteBody, SUB2_SITE_INCLUDE } from "@/lib/sub2-site";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.sub2Site.findUnique({ where: { id } });
  if (!existing) return notFound("调度台子不存在");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSiteBody(body, true);
  if ("error" in parsed) return badRequest(parsed.error);

  const item = await prisma.sub2Site.update({
    where: { id },
    data: parsed.data,
    include: SUB2_SITE_INCLUDE,
  });
  return jsonItem("sub2Site", g.session.role, publicSite(item));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.sub2Site.findUnique({ where: { id } });
  if (!existing) return notFound("调度台子不存在");
  await prisma.supplierMonitor.updateMany({
    where: { sub2SiteId: id },
    data: { sub2SiteId: null, sub2AccountId: null },
  });
  await prisma.sub2Site.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
