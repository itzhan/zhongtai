import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { isRole, type Role } from "./rbac";

const COOKIE_NAME = "bm_session";
const ALG = "HS256";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天

export interface Session {
  id: number;
  username: string;
  displayName: string;
  role: Role;
}

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

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
    .sign(getSecret());
}

/// Edge 与 Node 均可用 —— middleware 直接调这个, 不要重复实现一份 verify。
export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = Number(payload.sub);
    const role = payload.r;
    if (!Number.isFinite(id) || !isRole(role)) return null;
    return {
      id,
      username: String(payload.u ?? ""),
      displayName: String(payload.n ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

/// route handler / server component 里取当前会话。
export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return verifyToken(c.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const SESSION_COOKIE = COOKIE_NAME;
