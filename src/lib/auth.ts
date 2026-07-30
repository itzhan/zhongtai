import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { isRole } from "./rbac";
import { getJwtSecret, SESSION_COOKIE, verifyToken, type Session } from "./session";

const ALG = "HS256";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

/// 用户名 + 密码校验。返回 null 表示失败 —— 不区分"用户不存在"与
/// "密码错误", 避免用户名枚举。
export async function authenticate(
  username: string,
  password: string,
): Promise<Session | null> {
  const u = await prisma.user.findUnique({ where: { username } });
  if (!u || !u.active) return null;
  if (!(await bcrypt.compare(password, u.passwordHash))) return null;
  if (!isRole(u.role)) return null;
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role };
}

/// role 直接写进 JWT, 使 middleware (Edge runtime, 访问不到 Prisma) 能做
/// 页面级角色拦截。代价: 管理员改某人角色或停用后, 该用户的旧 token 在
/// 过期前仍带旧角色 —— 补偿手段是所有【写操作】用 requireRoleFresh,
/// 它会回查数据库拿最新状态 (见 src/lib/guard.ts)。
export async function issueToken(s: Session): Promise<string> {
  return new SignJWT({ u: s.username, n: s.displayName, r: s.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(s.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

/// route handler / server component 里取当前会话。
export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return verifyToken(c.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export { SESSION_COOKIE, verifyToken, type Session } from "./session";
