import { NextResponse } from "next/server";
import { issueToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/guard";
import { isRole } from "@/lib/rbac";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!isRole(body.role)) return NextResponse.json({ error: "角色非法" }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { role: body.role, active: true }, orderBy: { id: "asc" } });
  if (!user) return NextResponse.json({ error: "该角色没有可用测试账号" }, { status: 404 });
  const session = { id: user.id, username: user.username, displayName: user.displayName, role: body.role };
  await setSessionCookie(await issueToken(session));
  return NextResponse.json({ item: session });
}
