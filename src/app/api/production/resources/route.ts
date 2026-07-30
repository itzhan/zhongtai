import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, name: true } },
  allocator: { select: { id: true, displayName: true } },
  items: { include: {
    email: { select: { id: true, address: true, password: true, recoveryInfo: true } },
    proxy: { select: { id: true, host: true, port: true, username: true, password: true, protocol: true, expiresAt: true } },
    card: { select: { id: true, cardNo: true, cvv: true, expiry: true } },
  }, orderBy: { id: "asc" as const } },
} as const;

export async function GET() {
  const g = await requireRole(ROLES.PRODUCTION);
  if (!g.ok) return g.res;
  const items = await prisma.resourceAllocation.findMany({ where: { assigneeId: g.session.id }, include: INCLUDE, orderBy: { allocatedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { ids?: number[]; used?: boolean };
  const ids = [...new Set((body.ids ?? []).map(Number).filter(Number.isInteger))];
  if (!ids.length || typeof body.used !== "boolean") return badRequest("请选择资源并指定状态");
  const owned = await prisma.resourceAllocationItem.count({ where: { id: { in: ids }, allocation: { assigneeId: g.session.id } } });
  if (owned !== ids.length) return badRequest("包含不属于当前账号的资源");
  await prisma.resourceAllocationItem.updateMany({ where: { id: { in: ids } }, data: { used: body.used } });
  return NextResponse.json({ ok: true, count: ids.length });
}
