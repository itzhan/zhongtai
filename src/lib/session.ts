import { jwtVerify } from "jose";
import { isRole, type Role } from "./rbac";

export const SESSION_COOKIE = "bm_session";

export interface Session {
  id: number;
  username: string;
  displayName: string;
  role: Role;
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

// 该模块会被 Edge middleware 引用，不得引入 Prisma、bcrypt 或 next/headers。
export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
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
