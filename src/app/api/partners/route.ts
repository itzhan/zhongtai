import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const items = await prisma.partner.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }] } : {},
    orderBy: { id: "asc" },
  });
  return jsonItems("partner", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("请填写名称");
  const item = await prisma.partner.create({
    data: {
      name,
      contact: String(body.contact ?? "").trim(),
      note: String(body.note ?? "").trim(),
    },
  });
  return jsonItem("partner", g.session.role, item);
}
