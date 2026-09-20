import { prisma } from "@/lib/db";
import { canSeeCustomer, parseResourceBody, withoutCost } from "@/lib/customer";
import { badRequest, forbidden, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

async function customerOrGuard(id: number, role: Role, sessionId: number) {
  const item = await prisma.customer.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!item) return { error: "notfound" as const };
  if (!canSeeCustomer(role, item.ownerId, sessionId)) return { error: "forbidden" as const };
  return { item };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const loaded = await customerOrGuard(id, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("客户不存在") : forbidden("无权查看他人的客户");
  const items = await prisma.customerResource.findMany({
    where: { customerId: id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return jsonItems("customerResource", g.session.role, items);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const loaded = await customerOrGuard(id, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("客户不存在") : forbidden("无权修改他人的客户");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseResourceBody(body, false);
  if ("error" in parsed) return badRequest(parsed.error);

  const item = await prisma.customerResource.create({
    data: { ...withoutCost(g.session.role, parsed), customerId: id },
  });
  return jsonItem("customerResource", g.session.role, item);
}
