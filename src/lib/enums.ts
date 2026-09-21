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

export const CARD_STATUS = ["available", "invalid", "used"] as const;
export type CardStatus = (typeof CARD_STATUS)[number];
export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  available: "可用",
  invalid: "异常",
  used: "已使用",
};
export const CARD_STATUS_VARIANT: Record<CardStatus, BadgeVariant> = {
  available: "success",
  invalid: "destructive",
  used: "secondary",
};

/// 资源类别 —— 来源、申报明细、采购记录共用
export const RESOURCE_KIND = ["email", "proxy", "card"] as const;
export type ResourceKind = (typeof RESOURCE_KIND)[number];
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  email: "邮箱",
  proxy: "代理 IP",
  card: "卡",
};

/// 采购记录额外允许 other（旧资源采购链路仍用；项目利润已不读 Purchase）
export const PURCHASE_KIND = [...RESOURCE_KIND, "other"] as const;
export type PurchaseKind = (typeof PURCHASE_KIND)[number];
export const PURCHASE_KIND_LABEL: Record<PurchaseKind, string> = {
  ...RESOURCE_KIND_LABEL,
  other: "其他",
};

/// 项目收支流水方向
export const FINANCE_KIND = ["income", "cost", "receivable"] as const;
export type FinanceKind = (typeof FINANCE_KIND)[number];
export const FINANCE_KIND_LABEL: Record<FinanceKind, string> = {
  income: "收入",
  cost: "成本",
  receivable: "待收款",
};
export const FINANCE_KIND_VARIANT: Record<FinanceKind, BadgeVariant> = {
  income: "success",
  cost: "warning",
  receivable: "info",
};

/// 成本来源
export const COST_SOURCE = ["self", "supplier"] as const;
export type CostSource = (typeof COST_SOURCE)[number];
export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  self: "自产",
  supplier: "供应商",
};
export const COST_SOURCE_VARIANT: Record<CostSource, BadgeVariant> = {
  self: "secondary",
  supplier: "info",
};

/// 团队资金类型
export const FUND_KIND = ["held", "receivable"] as const;
export type FundKind = (typeof FUND_KIND)[number];
export const FUND_KIND_LABEL: Record<FundKind, string> = {
  held: "所持资金",
  receivable: "未结账单",
};
export const FUND_KIND_VARIANT: Record<FundKind, BadgeVariant> = {
  held: "success",
  receivable: "warning",
};

export const FUND_CURRENCY = ["cny", "usdt"] as const;
export type FundCurrency = (typeof FUND_CURRENCY)[number];
export const FUND_CURRENCY_LABEL: Record<FundCurrency, string> = {
  cny: "人民币",
  usdt: "U",
};
export const FUND_CURRENCY_VARIANT: Record<FundCurrency, BadgeVariant> = {
  cny: "secondary",
  usdt: "info",
};

/// 转账双方类型
export const PARTY_KIND = ["member", "partner"] as const;
export type PartyKind = (typeof PARTY_KIND)[number];
export const PARTY_KIND_LABEL: Record<PartyKind, string> = {
  member: "团队成员",
  partner: "合作伙伴",
};

/// 转账渠道
export const PAY_CHANNEL = ["alipay", "wechat", "bank"] as const;
export type PayChannel = (typeof PAY_CHANNEL)[number];
export const PAY_CHANNEL_LABEL: Record<PayChannel, string> = {
  alipay: "支付宝",
  wechat: "微信",
  bank: "银行卡",
};
export const PAY_CHANNEL_VARIANT: Record<PayChannel, BadgeVariant> = {
  alipay: "info",
  wechat: "success",
  bank: "secondary",
};

/// 供货方业务分类
export const SUPPLIER_CATEGORY = ["gpt", "claude", "aws", "cardshop"] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORY)[number];
export const SUPPLIER_CATEGORY_LABEL: Record<SupplierCategory, string> = {
  gpt: "GPT",
  claude: "Claude",
  aws: "AWS",
  cardshop: "卡网",
};
export const SUPPLIER_CATEGORY_VARIANT: Record<SupplierCategory, BadgeVariant> = {
  gpt: "info",
  claude: "purple",
  aws: "warning",
  cardshop: "success",
};

/// 从货名里认 GPT / Claude / AWS / 卡网关键词，认不出就回落中性灰
export function goodsKeyword(name: string): SupplierCategory | null {
  const s = name.toLowerCase();
  if (s.includes("claude") || s.includes("anthropic")) return "claude";
  if (s.includes("aws") || s.includes("amazon")) return "aws";
  if (s.includes("gpt") || s.includes("openai") || s.includes("chatgpt")) return "gpt";
  if (
    s.includes("卡网") ||
    s.includes("visa") ||
    s.includes("mastercard") ||
    s.includes("amex") ||
    s.includes("虚拟卡") ||
    s.includes("礼品卡")
  ) {
    return "cardshop";
  }
  return null;
}

export function goodsKeywordVariant(name: string): BadgeVariant {
  const key = goodsKeyword(name);
  return key ? SUPPLIER_CATEGORY_VARIANT[key] : "secondary";
}

export function normalizeRate(raw: string): string {
  return raw.trim().replace(/\s*[~\-～—–]\s*/g, "-");
}

/// 倍率区间取下限：`0.1-0.2` → 0.1
export function parseRateLowerBound(rate: string): number | null {
  const n = normalizeRate(rate);
  const m = n.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

export const MONITOR_STATUS = ["up", "slow", "down", "limited", "unknown"] as const;
export type MonitorStatus = (typeof MONITOR_STATUS)[number];
export const MONITOR_STATUS_LABEL: Record<MonitorStatus, string> = {
  up: "正常",
  slow: "偏慢",
  down: "异常",
  limited: "限流",
  unknown: "未探测",
};
export const MONITOR_STATUS_VARIANT: Record<MonitorStatus, BadgeVariant> = {
  up: "success",
  slow: "warning",
  down: "destructive",
  limited: "info",
  unknown: "secondary",
};

/// 渠道动态评级，由近几次探测结果推导，不落库
export const MONITOR_GRADE = ["excellent", "unstable", "unavailable", "unknown"] as const;
export type MonitorGrade = (typeof MONITOR_GRADE)[number];
export const MONITOR_GRADE_LABEL: Record<MonitorGrade, string> = {
  excellent: "优秀",
  unstable: "不稳定",
  unavailable: "不可用",
  unknown: "未评级",
};
export const MONITOR_GRADE_VARIANT: Record<MonitorGrade, BadgeVariant> = {
  excellent: "success",
  unstable: "warning",
  unavailable: "destructive",
  unknown: "secondary",
};

/// 探测协议：GPT Completions / GPT Responses / Claude messages
export const MONITOR_KIND = ["openai", "openai_response", "claude"] as const;
export type MonitorKind = (typeof MONITOR_KIND)[number];
export const MONITOR_KIND_LABEL: Record<MonitorKind, string> = {
  openai: "GPT Completions",
  openai_response: "GPT Responses",
  claude: "Claude",
};
export const MONITOR_KIND_VARIANT: Record<MonitorKind, BadgeVariant> = {
  openai: "info",
  openai_response: "info",
  claude: "purple",
};
export const MONITOR_KIND_PATH: Record<MonitorKind, string> = {
  openai: "/v1/chat/completions",
  openai_response: "/v1/responses",
  claude: "/v1/messages",
};
export const MONITOR_DEFAULT_MODEL: Record<MonitorKind, string> = {
  openai: "gpt-5.5",
  openai_response: "gpt-5.5",
  claude: "claude-sonnet-4-6",
};

export function defaultMonitorModel(kind: MonitorKind, model?: string): string {
  const current = (model ?? "").trim();
  if (!current) return MONITOR_DEFAULT_MODEL[kind];
  return current;
}

export function monitorPlatform(kind: MonitorKind): "openai" | "anthropic" {
  return kind === "claude" ? "anthropic" : "openai";
}

export const DISPATCH_ACTION = [
  "pause",
  "resume",
  "set_priority",
  "set_load_factor",
  "set_concurrency",
  "recover",
  "reset",
] as const;
export type DispatchAction = (typeof DISPATCH_ACTION)[number];
export const DISPATCH_ACTION_LABEL: Record<DispatchAction, string> = {
  pause: "关闭调度",
  resume: "打开调度",
  set_priority: "改优先级",
  set_load_factor: "改负载因子",
  set_concurrency: "改并发",
  recover: "恢复错误态",
  reset: "重置并发",
};

export function splitGoodsNames(value: string): string[] {
  return value
    .split(/[,，、/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSupplierCategories(v: unknown): SupplierCategory[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,，\s]+/) : [];
  const picked = new Set<SupplierCategory>();
  for (const item of raw) {
    const s = String(item).trim().toLowerCase();
    if (isOneOf(SUPPLIER_CATEGORY, s)) picked.add(s);
  }
  return SUPPLIER_CATEGORY.filter((c) => picked.has(c));
}

export function serializeSupplierCategories(cats: readonly SupplierCategory[]): string {
  return SUPPLIER_CATEGORY.filter((c) => cats.includes(c)).join(",");
}

/// 客户资源卖价口径
export const SELL_MODE = ["discount", "unit"] as const;
export type SellMode = (typeof SELL_MODE)[number];
export const SELL_MODE_LABEL: Record<SellMode, string> = {
  discount: "折扣",
  unit: "固定单价",
};

/// 客户资源成本口径
export const COST_MODE = ["fixed", "api"] as const;
export type CostMode = (typeof COST_MODE)[number];
export const COST_MODE_LABEL: Record<CostMode, string> = {
  fixed: "固定记账",
  api: "API 自动",
};

/// 客户资源对应的 sub2 平台，用来拆分消耗
export const CUSTOMER_PLATFORM = ["openai", "anthropic", "gemini", "grok"] as const;
export type CustomerPlatform = (typeof CUSTOMER_PLATFORM)[number];
export const CUSTOMER_PLATFORM_LABEL: Record<CustomerPlatform, string> = {
  openai: "GPT",
  anthropic: "Claude",
  gemini: "Gemini",
  grok: "Grok",
};
export const CUSTOMER_PLATFORM_VARIANT: Record<CustomerPlatform, BadgeVariant> = {
  openai: "info",
  anthropic: "purple",
  gemini: "warning",
  grok: "secondary",
};

/// 台子对接的中转 API 分类
export const DESK_API_KIND = ["none", "newapi", "sub2api"] as const;
export type DeskApiKind = (typeof DESK_API_KIND)[number];
export const DESK_API_KIND_LABEL: Record<DeskApiKind, string> = {
  none: "不对接",
  newapi: "NewAPI",
  sub2api: "Sub2API",
};
export const DESK_API_KIND_VARIANT: Record<DeskApiKind, BadgeVariant> = {
  none: "secondary",
  newapi: "info",
  sub2api: "purple",
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

export const BATCH_STATUS = ["in_use", "banned", "refunded"] as const;
export type BatchStatus = (typeof BATCH_STATUS)[number];
export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  in_use: "使用中",
  banned: "已封号",
  refunded: "已退款",
};
export const BATCH_STATUS_VARIANT: Record<BatchStatus, BadgeVariant> = {
  in_use: "success",
  banned: "destructive",
  refunded: "warning",
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
