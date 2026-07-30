import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";
export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind"); const id = Number(sp.get("id"));
  if (!id || !["email", "proxy", "card"].includes(kind ?? "")) return badRequest("资源参数非法");
  if (kind === "card" && g.session.role === ROLES.PRODUCTION) return badRequest("无权查看");
  const items = await prisma.resourceAllocationItem.findMany({
    where: { ...(kind === "email" ? { emailId: id } : kind === "proxy" ? { proxyId: id } : { cardId: id }), ...(g.session.role === ROLES.PRODUCTION ? { allocation: { assigneeId: g.session.id } } : {}) },
    include: { allocation: { include: { assignee: { select: { id: true, displayName: true } }, allocator: { select: { id: true, displayName: true } }, project: { select: { id: true, name: true } } } } },
    orderBy: { id: "desc" },
  });
  return NextResponse.json({ items });
}
