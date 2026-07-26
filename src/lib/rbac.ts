// 角色常量 —— 全系统唯一定义处。
// SQLite 下 Prisma 不支持 enum, 数据库里存 String, 这里是唯一的合法值
// 来源: schema 注释、seed 脚本、API 校验、前端菜单全部对齐这里。

export const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  PRODUCTION: "production",
  FINANCE: "finance",
  RESOURCE: "resource",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

export const ROLE_LABEL: Record<Role, string> = {
  admin: "管理员",
  sales: "销售",
  production: "生产",
  finance: "财务",
  resource: "资源管理员",
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v);
}

/// admin 隐式拥有一切权限 —— 全系统只有这一处定义该规则, 所以权限表里
/// 不需要到处写 admin。
export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return role === ROLES.ADMIN || allowed.includes(role);
}
