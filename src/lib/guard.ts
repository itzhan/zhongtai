// route handler 内的统一鉴权。
//
// 【约定】每个 handler 第一行必须自证, 不依赖 middleware —— middleware
// 的 matcher 无论怎么写都是黑名单, 将来加 basePath / rewrite 都可能漏。
//   GET               → requireRole
//   POST/PATCH/DELETE → requireRoleFresh
import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { prisma } from "./db";
import { ALL_ROLES, hasRole, isRole, ROLES, type Role } from "./rbac";

export type Guard = { ok: true; session: Session } | { ok: false; res: NextResponse };

const unauth = (): Guard => ({
  ok: false,
  res: NextResponse.json({ error: "未登录" }, { status: 401 }),
});

const forbid = (): Guard => ({
  ok: false,
  res: NextResponse.json({ error: "无权访问" }, { status: 403 }),
});

/// 读操作用。只验 JWT 不查库 —— 每个 GET 多一次 DB 往返不划算。
///
///   const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
///   if (!g.ok) return g.res;
///   // 之后可用 g.session.id / g.session.role
export async function requireRole(...roles: Role[]): Promise<Guard> {
  const session = await getSession();
  if (!session) return unauth();
  if (!hasRole(session.role, roles)) return forbid();
  return { ok: true, session };
}

/// 任意已登录角色。
export const requireAuth = () => requireRole(...ALL_ROLES);

/// 仅管理员。
export const requireAdmin = () => requireRole(ROLES.ADMIN);

/// 写操作用。额外查一次库, 保证被停用或被改角色的用户拿着旧 token 也
/// 写不了数据 —— 这是把 role 存进 JWT 的必要补偿。
export async function requireRoleFresh(...roles: Role[]): Promise<Guard> {
  const g = await requireRole(...roles);
  if (!g.ok) return g;

  const u = await prisma.user.findUnique({
    where: { id: g.session.id },
    select: { id: true, username: true, displayName: true, role: true, active: true },
  });
  if (!u || !u.active || !isRole(u.role)) return unauth();
  if (!hasRole(u.role, roles)) return forbid();

  return {
    ok: true,
    session: { id: u.id, username: u.username, displayName: u.displayName, role: u.role },
  };
}

export const requireAdminFresh = () => requireRoleFresh(ROLES.ADMIN);

/// 路径参数取整数 id。返回 null 表示非法, 调用方直接返回 400。
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const badRequest = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
export const notFound = (msg: string) => NextResponse.json({ error: msg }, { status: 404 });
export const forbidden = (msg = "无权访问") => NextResponse.json({ error: msg }, { status: 403 });
