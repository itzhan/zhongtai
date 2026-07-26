"use client";
import { hasRole, type Role } from "@/lib/rbac";
import { FIELDS, type FieldKey } from "@/lib/fields";
import { useRole } from "./RoleProvider";

/// 按角色或按字段决定要不要渲染。只管布局不出现空洞, 不是安全边界。
export default function RoleGate({
  roles,
  field,
  fallback = null,
  children,
}: {
  roles?: readonly Role[];
  field?: FieldKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const role = useRole();
  const ok = field ? hasRole(role, FIELDS[field]) : !roles || hasRole(role, roles);
  return <>{ok ? children : fallback}</>;
}
