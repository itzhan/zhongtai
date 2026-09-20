import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canSeeCustomer, resourcePatch, withoutCost } from "@/lib/customer";
import { badRequest, forbidden, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

async function loadResource(customerId: number, rid: number, role: Role, sessionId: number) {
  const row = await prisma.customerResource.findFirst({
    where: { id: rid, customerId },
    include: { customer: { select: { ownerId: true } } },
  });
  if (!row) return { error: "notfound" as const };
  if (!canSeeCustomer(role, row.customer.ownerId, sessionId)) return { error: "forbidden" as const };
  return { row };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; rid: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const params = await ctx.params;
  const id = parseId(params.id);
  const rid = parseId(params.rid);
  if (!id || !rid) return badRequest("id 非法");
  const loaded = await loadResource(id, rid, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("资源不存在") : forbidden("无权修改他人的客户");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patched = resourcePatch(body);
  if ("error" in patched) return badRequest(patched.error);

  const item = await prisma.customerResource.update({
    where: { id: rid },
    data: withoutCost(g.session.role, patched.data as Record<string, unknown>) as typeof patched.data,
  });
  return jsonItem("customerResource", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; rid: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const params = await ctx.params;
  const id = parseId(params.id);
  const rid = parseId(params.rid);
  if (!id || !rid) return badRequest("id 非法");
  const loaded = await loadResource(id, rid, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("资源不存在") : forbidden("无权修改他人的客户");
  await prisma.customerResource.delete({ where: { id: rid } });
  return NextResponse.json({ ok: true });
}
