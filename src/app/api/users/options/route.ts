import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/guard";
import { isRole, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

/// 供各表单的「归属人」下拉框使用 —— 只返回 id / 姓名 / 角色, 任何登录
/// 用户都能读。支持 ?role=sales 过滤。
export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const roleParam = new URL(req.url).searchParams.get("role");
  const role: Role | undefined = isRole(roleParam) ? roleParam : undefined;

  const items = await prisma.user.findMany({
    where: { active: true, ...(role ? { role } : {}) },
    select: { id: true, displayName: true, role: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ items });
}
