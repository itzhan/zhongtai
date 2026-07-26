import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { badRequest, requireAdmin, requireAdminFresh } from "@/lib/guard";
import { isRole } from "@/lib/rbac";

export const runtime = "nodejs";

/// passwordHash 永不出现在响应里。
const SAFE = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
  note: true,
  createdAt: true,
} as const;

export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.res;

  const items = await prisma.user.findMany({ select: SAFE, orderBy: { id: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    username: string;
    displayName: string;
    password: string;
    role: string;
    note: string;
  }>;

  const username = (body.username ?? "").trim();
  const displayName = (body.displayName ?? "").trim();
  const password = body.password ?? "";

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return badRequest("用户名需为 3-32 位的英文、数字或 _ . -");
  }
  if (!displayName) return badRequest("请填写姓名");
  if (password.length < 6) return badRequest("密码至少 6 位");
  if (!isRole(body.role)) return badRequest("角色非法");

  const dup = await prisma.user.findUnique({ where: { username } });
  if (dup) return NextResponse.json({ error: "用户名已存在" }, { status: 409 });

  const item = await prisma.user.create({
    data: {
      username,
      displayName,
      role: body.role,
      note: body.note ?? "",
      passwordHash: await hashPassword(password),
    },
    select: SAFE,
  });
  return NextResponse.json({ item });
}
