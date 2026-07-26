// 侧边栏结构 + 页面路由权限的【单一数据源】。
//
// 本文件必须保持【纯数据、零 JSX、零 React import】—— middleware.ts 要
// import 它做页面级鉴权, 而 middleware 跑在 Edge runtime; import lucide
// 会把整个图标库打进 edge bundle。所以图标用字符串 key, 由 Sidebar.tsx
// 映射成组件。
import { ROLES, hasRole, type Role } from "./rbac";

const { SALES, PRODUCTION, FINANCE, RESOURCE } = ROLES;

/// 图标名 —— Sidebar / MobileNav 里映射到 lucide 组件。
export type IconKey =
  | "dashboard"
  | "project"
  | "product"
  | "desk"
  | "supplier"
  | "resource"
  | "production"
  | "purchase"
  | "settings";

export interface NavSubItem {
  href: string;
  label: string;
  /// 省略则继承父项的 roles
  roles?: readonly Role[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  /// 允许访问的角色。admin 不必写 —— hasRole 里已隐式放行
  roles: readonly Role[];
  /// 子页 TabNav。父项 href 指向默认子页, 高亮用 match 前缀
  sub?: NavSubItem[];
  /// 高亮与权限匹配的前缀, 省略时用 href
  match?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(e: NavEntry): e is NavGroup {
  return "group" in e;
}

export const NAV: NavEntry[] = [
  {
    href: "/",
    label: "仪表盘",
    icon: "dashboard",
    roles: [SALES, PRODUCTION, FINANCE, RESOURCE],
  },
  {
    group: "业务",
    items: [
      {
        href: "/projects",
        label: "项目管理",
        icon: "project",
        roles: [SALES, PRODUCTION, FINANCE, RESOURCE],
      },
      {
        href: "/products",
        label: "产品管理",
        icon: "product",
        roles: [SALES, PRODUCTION, FINANCE, RESOURCE],
      },
      { href: "/desks", label: "台子管理", icon: "desk", roles: [SALES, FINANCE] },
      { href: "/suppliers", label: "供货方", icon: "supplier", roles: [RESOURCE, FINANCE] },
    ],
  },
  {
    group: "生产与资源",
    items: [
      {
        href: "/production/batches",
        match: "/production",
        label: "生产管理",
        icon: "production",
        roles: [PRODUCTION, RESOURCE, FINANCE],
        sub: [
          { href: "/production/batches", label: "产出批次", roles: [PRODUCTION, FINANCE] },
          { href: "/production/requests", label: "消耗申报" },
        ],
      },
      {
        href: "/resources/cards",
        match: "/resources",
        label: "资源库",
        icon: "resource",
        // 整体放行给生产/财务, 卡号 CVV 与价格靠 src/lib/mask.ts 字段脱敏挡住
        roles: [RESOURCE, PRODUCTION, FINANCE],
        sub: [
          { href: "/resources/cards", label: "卡", roles: [RESOURCE, FINANCE] },
          { href: "/resources/proxies", label: "代理 IP" },
          { href: "/resources/emails", label: "邮箱" },
          { href: "/resources/sources", label: "来源" },
        ],
      },
      { href: "/purchases", label: "采购记录", icon: "purchase", roles: [RESOURCE, FINANCE] },
    ],
  },
  {
    group: "系统",
    items: [
      {
        href: "/settings",
        label: "设置",
        icon: "settings",
        roles: [SALES, PRODUCTION, FINANCE, RESOURCE],
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((e) => (isNavGroup(e) ? e.items : [e]));

function matchOf(item: NavItem): string {
  return item.match ?? item.href;
}

/// 路径是否落在某个前缀下。段边界 (base + "/") 不能省, 否则 /products
/// 与 /production 这类相邻前缀会互相误伤。
export function isUnder(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

/// 该角色能看到的菜单树。空组自动剔除, 子项也按角色过滤。
export function navFor(role: Role): NavEntry[] {
  const visible = (it: NavItem): NavItem | null => {
    if (!hasRole(role, it.roles)) return null;
    if (!it.sub) return it;
    const sub = it.sub.filter((s) => hasRole(role, s.roles ?? it.roles));
    if (!sub.length) return null;
    // 父项 href 指向该角色可见的第一个子页, 避免点进去撞 403
    return { ...it, sub, href: sub[0].href };
  };

  return NAV.map((e) => {
    if (!isNavGroup(e)) return visible(e);
    const items = e.items.map(visible).filter((x): x is NavItem => x !== null);
    return items.length ? { group: e.group, items } : null;
  }).filter((x): x is NavEntry => x !== null);
}

/// 扁平列表, 用于「当前页是哪一项」的查找。
export function flatNavFor(role: Role): NavItem[] {
  return navFor(role).flatMap((e) => (isNavGroup(e) ? e.items : [e]));
}

/// 某个带子页的模块下, 该角色可见的 tab 列表。
export function tabsFor(role: Role, pathname: string): NavSubItem[] {
  const item = NAV_ITEMS.find((it) => it.sub && isUnder(pathname, matchOf(it)));
  if (!item?.sub) return [];
  return item.sub.filter((s) => hasRole(role, s.roles ?? item.roles));
}

/// 页面路由鉴权。最长前缀匹配, 使 /desks/12 命中 /desks 的规则;
/// 子页有自己的 roles 时以子页为准。
/// 返回 null = 不在权限表内 (登录即可访问, 如 /403)。
export function pageRoles(pathname: string): readonly Role[] | null {
  let best: { len: number; roles: readonly Role[] } | null = null;
  const take = (base: string, roles: readonly Role[]) => {
    if (!isUnder(pathname, base)) return;
    if (!best || base.length > best.len) best = { len: base.length, roles };
  };

  for (const item of NAV_ITEMS) {
    take(matchOf(item), item.roles);
    for (const s of item.sub ?? []) take(s.href, s.roles ?? item.roles);
  }
  return best ? (best as { roles: readonly Role[] }).roles : null;
}

export function canVisit(role: Role, pathname: string): boolean {
  const roles = pageRoles(pathname);
  return roles === null ? true : hasRole(role, roles);
}
