"use client";
import { createContext, useContext } from "react";
import { hasRole, type Role } from "@/lib/rbac";
import { FIELDS, type FieldKey } from "@/lib/fields";

export interface SessionInfo {
  id: number;
  username: string;
  displayName: string;
  role: Role;
}

const Ctx = createContext<SessionInfo | null>(null);

/// 会话由 (app)/layout.tsx 这个 server component 读 cookie 后注入,
/// 所以页面不需要各自 fetch("/api/auth/me")。
export function RoleProvider({
  value,
  children,
}: {
  value: SessionInfo;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionInfo {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession 必须在 RoleProvider 内使用");
  return s;
}

export function useRole(): Role {
  return useSession().role;
}

/// 字段可见性判断。注意这【不是安全边界】—— 真正的脱敏在 API 层
/// (src/lib/mask.ts), 这里只决定要不要渲染那一列, 避免出现整列 "-"。
export function useCan(): (field: FieldKey) => boolean {
  const role = useRole();
  return (field) => hasRole(role, FIELDS[field]);
}
