// 字段脱敏 —— 全系统唯一的规则来源。
//
// 脱敏【必须在 API 层】做: 前端隐藏毫无意义, devtools 一开 network 就
// 全看到了。不用 Prisma $extends 做这件事 —— 扩展拿不到 HTTP 请求上下文
// (当前角色), 要靠 AsyncLocalStorage 传, 复杂度远超收益。显式
// jsonItems(entity, role, rows) 一行调用已经够, 且在代码里看得见
// "这个接口脱敏了什么"。
import { NextResponse } from "next/server";
import { ROLES, type Role } from "./rbac";

const { SALES, PRODUCTION, FINANCE, RESOURCE } = ROLES;

/// 实体 → 字段 → 允许看到该字段的角色。
/// admin 在 mask() 里短路放行, 所以这里不用写 admin。
/// 未列出的字段 = 所有通过了页面级鉴权的角色都能看。
const SENSITIVE = {
  desk: {},
  deskItem: { unitPrice: [SALES, FINANCE] }, // 生产看不到卖价
  supplier: {},
  supplierItem: { unitPrice: [RESOURCE, FINANCE] }, // 销售看不到进价
  request: {},
  requestItem: { amount: [RESOURCE, FINANCE] },
  purchase: { totalAmount: [RESOURCE, FINANCE], detail: [RESOURCE, FINANCE] },
  source: {
    priceInfo: [RESOURCE, FINANCE],
    emailPrice: [RESOURCE, FINANCE],
    proxyPrice: [RESOURCE, FINANCE],
    cardPrice: [RESOURCE, FINANCE],
  },
  card: { cardNo: [RESOURCE], cvv: [RESOURCE], amount: [RESOURCE, FINANCE] },
  proxy: { password: [RESOURCE, PRODUCTION] }, // 生产要用所以可见
  email: { password: [RESOURCE, PRODUCTION] },
  project: { cost: [FINANCE], profit: [FINANCE], margin: [FINANCE] },
  product: {},
  batch: {},
  user: {},
} satisfies Record<string, Record<string, readonly Role[]>>;

export type Entity = keyof typeof SENSITIVE;

/// 嵌套关系: 父实体的某字段是子实体 (数组或对象) 时递归脱敏, 使
/// Prisma include 出来的树不会漏网。
const NESTED: Partial<Record<Entity, Record<string, Entity>>> = {
  desk: { items: "deskItem", project: "project" },
  supplier: { items: "supplierItem", project: "project" },
  request: { items: "requestItem", purchases: "purchase" },
  card: { source: "source" },
  proxy: { source: "source" },
  email: { source: "source" },
  purchase: { source: "source" },
  requestItem: { source: "source" },
};

/// 遮蔽 = 置 null 而不是 delete key。前端类型不变, 直接 `?? "-"` 渲染,
/// 不用为每个角色写不同的 TS 类型。
export function mask<T>(entity: Entity, role: Role, row: T): T {
  if (role === ROLES.ADMIN || row == null) return row;

  const rules = SENSITIVE[entity] as Record<string, readonly Role[]>;
  const nested = NESTED[entity];
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };

  for (const [field, allowed] of Object.entries(rules)) {
    if (field in out && !allowed.includes(role)) out[field] = null;
  }
  for (const [field, child] of Object.entries(nested ?? {})) {
    const v = out[field];
    if (Array.isArray(v)) out[field] = v.map((c) => mask(child, role, c));
    else if (v && typeof v === "object") out[field] = mask(child, role, v);
  }
  return out as T;
}

export const maskMany = <T>(entity: Entity, role: Role, rows: T[]): T[] =>
  rows.map((r) => mask(entity, role, r));

// ── handler 一行返回, 顺带统一 {item} / {items} 约定 ──────────────
export const jsonItem = (entity: Entity, role: Role, item: unknown) =>
  NextResponse.json({ item: mask(entity, role, item) });

export const jsonItems = (entity: Entity, role: Role, items: unknown[]) =>
  NextResponse.json({ items: maskMany(entity, role, items) });
