import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { badRequest, requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    oldPassword: string;
    newPassword: string;
  }>;
  const oldPassword = body.oldPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (newPassword.length < 6) return badRequest("新密码至少 6 位");

  const user = await prisma.user.findUnique({ where: { id: g.session.id } });
  if (!user) return badRequest("用户不存在");
  if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
    return badRequest("原密码不正确");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return NextResponse.json({ ok: true });
}
