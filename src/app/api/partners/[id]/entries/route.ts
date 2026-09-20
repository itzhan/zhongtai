import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { partyClause } from "@/lib/ledger";
import { maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) return notFound("合作伙伴不存在");
  const items = await prisma.financeEntry.findMany({
    where: { deletedAt: null, ...partyClause("partner", id) },
    include: INCLUDE,
    orderBy: [{ entryDate: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ items: maskMany("financeEntry", g.session.role, items) });
}
