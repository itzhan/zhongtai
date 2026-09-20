import { prisma } from "@/lib/db";
import { CUSTOMER_INCLUDE, canSeeCustomer, parseResourceBody, parseStatus, withoutCost } from "@/lib/customer";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status");
  const ownerId = sp.get("ownerId");

  const items = await prisma.customer.findMany({
    where: {
      ...(g.session.role === ROLES.SALES ? { ownerId: g.session.id } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { contact: { contains: q } },
              { ownerName: { contains: q } },
              { sub2UserName: { contains: q } },
              { sub2UserEmail: { contains: q } },
            ],
          }
        : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(ownerId && ownerId !== "all" && g.session.role !== ROLES.SALES ? { ownerId: Number(ownerId) } : {}),
    },
    include: CUSTOMER_INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("customer", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("请填写客户名称");
  const status = parseStatus(body.status);
  if (status && typeof status === "object") return badRequest(status.error);

  let ownerId = g.session.id;
  if (body.ownerId !== undefined && g.session.role !== ROLES.SALES) {
    const n = Number(body.ownerId);
    if (!Number.isInteger(n) || n <= 0) return badRequest("归属人不合法");
    const owner = await prisma.user.findUnique({ where: { id: n }, select: { id: true, displayName: true } });
    if (!owner) return badRequest("归属人不存在");
    ownerId = owner.id;
  }
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true } });
  if (!canSeeCustomer(g.session.role, ownerId, g.session.id)) return badRequest("无权代建他人客户");

  const resourceRows = Array.isArray(body.resources) ? body.resources : [];
  const resources = [];
  for (const row of resourceRows) {
    const parsed = parseResourceBody((row ?? {}) as Record<string, unknown>, false);
    if ("error" in parsed) return badRequest(parsed.error);
    resources.push(withoutCost(g.session.role, parsed));
  }

  const item = await prisma.customer.create({
    data: {
      name,
      ownerId,
      ownerName: String(body.ownerName ?? "").trim() || owner?.displayName || "",
      contact: String(body.contact ?? ""),
      status: typeof status === "string" ? status : "active",
      notes: String(body.notes ?? ""),
      resources: { create: resources },
    },
    include: CUSTOMER_INCLUDE,
  });

  return jsonItem("customer", g.session.role, item);
}
