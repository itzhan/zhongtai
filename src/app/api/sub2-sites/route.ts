import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";
import { publicSite } from "@/lib/sub2-client";
import { parseSiteBody, SUB2_SITE_INCLUDE } from "@/lib/sub2-site";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const items = await prisma.sub2Site.findMany({ include: SUB2_SITE_INCLUDE, orderBy: { id: "asc" } });
  return jsonItems(
    "sub2Site",
    g.session.role,
    items.map((row) => publicSite(row)),
  );
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSiteBody(body, false);
  if ("error" in parsed) return badRequest(parsed.error);
  const item = await prisma.sub2Site.create({ data: parsed.data as never, include: SUB2_SITE_INCLUDE });
  return jsonItem("sub2Site", g.session.role, publicSite(item));
}
