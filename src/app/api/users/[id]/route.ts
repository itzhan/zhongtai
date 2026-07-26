import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { badRequest, notFound, parseId, requireAdminFresh } from "@/lib/guard";
import { isRole } from "@/lib/rbac";

export const runtime = "nodejs";

const SAFE = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
  note: true,
  createdAt: true,
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound("用户不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    displayName: string;
    role: string;
    active: boolean;
    note: string;
    password: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.displayName !== undefined) {
    const v = body.displayName.trim();
    if (!v) return badRequest("姓名不能为空");
    data.displayName = v;
  }
  if (body.role !== undefined) {
    if (!isRole(body.role)) return badRequest("角色非法");
    // 不允许把自己降级 —— 否则最后一个管理员能把自己锁在门外
    if (id === g.session.id && body.role !== "admin") {
      return badRequest("不能修改自己的角色");
    }
    data.role = body.role;
  }
  if (body.active !== undefined) {
    if (id === g.session.id && !body.active) return badRequest("不能停用自己");
    data.active = Boolean(body.active);
  }
  if (body.note !== undefined) data.note = body.note;
  if (body.password !== undefined) {
    if (body.password.length < 6) return badRequest("密码至少 6 位");
    data.passwordHash = await hashPassword(body.password);
  }

  const item = await prisma.user.update({ where: { id }, data, select: SAFE });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  if (id === g.session.id) return badRequest("不能删除自己");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound("用户不存在");

  // 用户被台子/采购/申报等引用时删不掉 (外键无 onDelete)。
  // 这是刻意的 —— 归属人是业务凭证, 应该停用而不是删除。
  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return badRequest("该用户已关联业务数据, 请改用「停用」");
  }
  return NextResponse.json({ ok: true });
}
