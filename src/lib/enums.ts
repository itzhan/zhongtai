// schema 里所有 String「枚举」的合法值 —— SQLite 下 Prisma 不支持 enum,
// 所以约束在这一层。API 校验、前端下拉框、状态徽标都读这里。
//
// 每组都配一份 LABEL 映射 (中文文案只写一次), 需要上色的再配一份
// VARIANT 映射 (对应 ui/badge.tsx 的 variant)。

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "purple";

export const PROJECT_STATUS = ["active", "paused", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "进行中",
  paused: "暂停",
  closed: "已结束",
};
export const PROJECT_STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  active: "success",
  paused: "warning",
  closed: "secondary",
};

/// 台子与供货方共用
export const PARTNER_STATUS = ["active", "paused", "closed"] as const;
export type PartnerStatus = (typeof PARTNER_STATUS)[number];
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  active: "合作中",
  paused: "暂停",
  closed: "已终止",
};
export const PARTNER_STATUS_VARIANT: Record<PartnerStatus, BadgeVariant> = {
  active: "success",
  paused: "warning",
  closed: "secondary",
};

export const RESOURCE_STATUS = ["available", "in_use", "used", "invalid"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUS)[number];
export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  available: "可用",
  in_use: "使用中",
  used: "已用完",
  invalid: "失效",
};
export const RESOURCE_STATUS_VARIANT: Record<ResourceStatus, BadgeVariant> = {
  available: "success",
  in_use: "info",
  used: "secondary",
  invalid: "destructive",
};

/// 资源类别 —— 来源、申报明细、采购记录共用
export const RESOURCE_KIND = ["email", "proxy", "card"] as const;
export type ResourceKind = (typeof RESOURCE_KIND)[number];
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  email: "邮箱",
  proxy: "代理 IP",
  card: "卡",
};

/// 采购记录额外允许 other
export const PURCHASE_KIND = [...RESOURCE_KIND, "other"] as const;
export type PurchaseKind = (typeof PURCHASE_KIND)[number];
export const PURCHASE_KIND_LABEL: Record<PurchaseKind, string> = {
  ...RESOURCE_KIND_LABEL,
  other: "其他",
};

export const REQUEST_STATUS = ["pending", "approved", "purchased", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "待处理",
  approved: "已确认",
  purchased: "已采购",
  rejected: "已驳回",
};
export const REQUEST_STATUS_VARIANT: Record<RequestStatus, BadgeVariant> = {
  pending: "warning",
  approved: "info",
  purchased: "success",
  rejected: "destructive",
};

export const PROXY_PROTOCOL = ["socks", "http"] as const;
export type ProxyProtocol = (typeof PROXY_PROTOCOL)[number];
export const PROXY_PROTOCOL_LABEL: Record<ProxyProtocol, string> = {
  socks: "SOCKS",
  http: "HTTP",
};

/// 与 protocol 正交 —— 动态 IP 同样分 socks / http, 只是出口会变
export const PROXY_IP_TYPE = ["static", "dynamic"] as const;
export type ProxyIpType = (typeof PROXY_IP_TYPE)[number];
export const PROXY_IP_TYPE_LABEL: Record<ProxyIpType, string> = {
  static: "静态",
  dynamic: "动态",
};

/// 运行时校验: 值是否属于某个枚举
export function isOneOf<T extends readonly string[]>(
  list: T,
  v: unknown,
): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}
