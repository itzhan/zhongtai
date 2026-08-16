// AI 助手：操作类型、默认模板、系统提示与解析约定
import {
  CARD_STATUS,
  FINANCE_KIND,
  isOneOf,
  PARTNER_STATUS,
  PROJECT_STATUS,
  PROXY_IP_TYPE,
  PROXY_PROTOCOL,
  RESOURCE_STATUS,
} from "./enums";
import { todayStr } from "./format";
import { ROLES, type Role } from "./rbac";

export const ASSISTANT_ACTIONS = [
  "bookkeep",
  "create_project",
  "create_product",
  "create_desk",
  "create_supplier",
  "create_source",
  "create_card",
  "create_proxy",
  "create_email",
] as const;

export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export function isAssistantAction(v: unknown): v is AssistantAction {
  return typeof v === "string" && (ASSISTANT_ACTIONS as readonly string[]).includes(v);
}

export interface ActionMeta {
  id: AssistantAction;
  label: string;
  description: string;
  /// 允许使用该操作的角色（admin 隐式全通）
  roles: readonly Role[];
  template: string;
}

export const ACTION_META: Record<AssistantAction, ActionMeta> = {
  bookkeep: {
    id: "bookkeep",
    label: "记账（成本/收入）",
    description: "把花费、回款记到指定项目流水",
    // 财务核心能力
    roles: [ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE],
    template: `请把下面内容整理成项目收支流水（可多条）：

项目：【填写项目名称】
今天成本：【金额】，说明：【用途】
今天收入：【金额】，说明：【来源】

（也可直接写：项目 XX 今天花了 300 买邮箱，回款 1000）`,
  },
  create_project: {
    id: "create_project",
    label: "新建项目",
    description: "创建项目，可选需求清单/产出批次开关",
    roles: [ROLES.ADMIN],
    template: `请创建项目：

名称：【项目名称】
负责人：【姓名，可空】
状态：进行中 / 暂停 / 已结束
说明：【做什么】
是否启用甲方需求清单：是/否
是否启用产出批次：是/否`,
  },
  create_product: {
    id: "create_product",
    label: "新建产品",
    description: "创建产品，可绑定项目",
    roles: [ROLES.ADMIN],
    template: `请创建产品：

产品名：【名称】
归属项目：【项目名，可空表示通用】
状态：【如 稳定供货】
产能：【如 日均 200】
备注：【可空】`,
  },
  create_desk: {
    id: "create_desk",
    label: "新建台子",
    description: "下游客户台子 + 货明细卖价",
    // 台子属销售侧；财务不参与台子录入
    roles: [ROLES.SALES],
    template: `请创建台子：

台子名称：【客户代号】
归属项目：【项目名】
Base URL：【可空】
需求说明：【可空】
状态：合作中 / 暂停 / 已终止
货明细：
- 产品【名称】卖价【金额】备注【可空】
- 产品【名称】卖价【金额】`,
  },
  create_supplier: {
    id: "create_supplier",
    label: "新建供货方",
    description: "上游供货方 + 进货价明细",
    // 供货方属资源侧
    roles: [ROLES.RESOURCE],
    template: `请创建供货方：

名称：【供应商名】
归属项目：【项目名】
渠道说明：【可空】
Base URL：【可空】
状态：合作中 / 暂停 / 已终止
货明细：
- 产品【名称】进价【金额】API Key【可空】备注【可空】`,
  },
  create_source: {
    id: "create_source",
    label: "新建资源来源",
    description: "资源库「来源渠道」",
    roles: [ROLES.RESOURCE],
    template: `请创建资源来源：

名称：【渠道名】
渠道说明：【TG/网站等】
适用类型：邮箱,代理,卡（逗号分隔，可空=通用）
联系方式：【可空】
邮箱参考价 / 代理参考价 / 卡参考价：【数字，可 0】
价格说明：【可空】
备注：【可空】`,
  },
  create_card: {
    id: "create_card",
    label: "新建卡资源",
    description: "录入虚拟卡到资源库",
    roles: [ROLES.RESOURCE],
    template: `请录入卡资源（可多条）：

卡号：【4242...】
CVV：【123】
有效期：【MM/YY】
持卡人：【可空】
余额/额度：【数字】
适用业务：【Claude,GPT】
来源：【来源渠道名，可空】
归属项目：【项目名，可空】
状态：可用 / 异常 / 已使用
备注：【可空】

（也可多行：卡号 有效期 CVV 金额）`,
  },
  create_proxy: {
    id: "create_proxy",
    label: "新建代理 IP",
    description: "录入代理到资源库",
    roles: [ROLES.RESOURCE],
    template: `请录入代理 IP（可多条）：

协议：socks / http
类型：静态 / 动态
地址：【host】
端口：【port】
用户名 / 密码：【可空】
地区：【US/SG 等】
换 IP 地址：【动态 IP 可填】
来源：【来源渠道名，可空】
归属项目：【可空】
状态：可用 / 使用中 / 已用完 / 失效
备注：【可空】`,
  },
  create_email: {
    id: "create_email",
    label: "新建邮箱资源",
    description: "录入邮箱到资源库",
    roles: [ROLES.RESOURCE],
    template: `请录入邮箱资源（可多条）：

邮箱：【address@example.com】
密码：【password】
接码类型：mock（或其它 provider）
适用业务：【Claude,GPT】
来源：【来源渠道名，可空】
归属项目：【可空】
状态：可用 / 使用中 / 已用完 / 失效
备注：【可空】

（也可多行：邮箱----密码）`,
  },
};

export function actionsForRole(role: Role): ActionMeta[] {
  return ASSISTANT_ACTIONS.map((id) => ACTION_META[id]).filter(
    (a) => role === ROLES.ADMIN || a.roles.includes(role),
  );
}

export interface ProjectOption {
  id: number;
  code: string;
  name: string;
}

export interface SourceOption {
  id: number;
  name: string;
}

function projectListText(projects: ProjectOption[]): string {
  if (!projects.length) return "（当前没有项目）";
  return projects.map((p) => `- id=${p.id} code=${p.code} name=${p.name}`).join("\n");
}

function sourceListText(sources: SourceOption[]): string {
  if (!sources.length) return "（当前没有资源来源）";
  return sources.map((s) => `- id=${s.id} name=${s.name}`).join("\n");
}

function yesterdayStr(): string {
  const t = new Date(`${todayStr()}T00:00:00Z`).getTime() - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function buildSystemPrompt(
  action: AssistantAction,
  projects: ProjectOption[],
  sources: SourceOption[] = [],
): string {
  const common = `你是中转利润管理中台的操作助手。只输出 JSON（不要 markdown）。
今天: ${todayStr()}（Asia/Shanghai）
昨天: ${yesterdayStr()}
可用项目：
${projectListText(projects)}
可用资源来源：
${sourceListText(sources)}
`;

  switch (action) {
    case "bookkeep":
      return `${common}
任务：把用户口述整理成收支流水。
kind 只能是 cost 或 income。amount 为正数。entryDate 为 YYYY-MM-DD。
projectId 必须来自列表；匹配不到写 unresolved。
输出：
{"reply":"中文说明","items":[{"projectId":1,"projectName":"","kind":"cost","amount":100,"entryDate":"${todayStr()}","note":"说明"}],"unresolved":[]}`;

    case "create_project":
      return `${common}
任务：解析要创建的项目（可多条）。
status 只能是 active|paused|closed。
enableDemands / enableBatches 为 boolean。
输出：
{"reply":"","items":[{"name":"","ownerName":"","status":"active","description":"","enableDemands":false,"enableBatches":false}],"unresolved":[]}`;

    case "create_product":
      return `${common}
任务：解析要创建的产品（可多条）。
projectId 可空。
输出：
{"reply":"","items":[{"name":"","projectId":null,"projectName":"","status":"","capacity":"","notes":""}],"unresolved":[]}`;

    case "create_desk":
      return `${common}
任务：解析要创建的台子（可多条）。
status: active|paused|closed。projectId 必填。
items 为货明细，unitPrice 为卖价。
输出：
{"reply":"","items":[{"name":"","projectId":1,"projectName":"","baseUrl":"","demand":"","status":"active","notes":"","items":[{"productName":"","unitPrice":10,"note":""}]}],"unresolved":[]}`;

    case "create_supplier":
      return `${common}
任务：解析要创建的供货方（可多条）。
status: active|paused|closed。projectId 必填。
items 中 unitPrice 为进价。
输出：
{"reply":"","items":[{"name":"","projectId":1,"projectName":"","baseUrl":"","channel":"","status":"active","notes":"","items":[{"productName":"","unitPrice":8,"apiKey":"","note":""}]}],"unresolved":[]}`;

    case "create_source":
      return `${common}
任务：解析资源来源（可多条）。
kinds 为 email/proxy/card 数组或逗号分隔字符串。
输出：
{"reply":"","items":[{"name":"","channel":"","kinds":["email","proxy"],"contact":"","emailPrice":0,"proxyPrice":0,"cardPrice":0,"priceInfo":"","notes":"","active":true}],"unresolved":[]}`;

    case "create_card":
      return `${common}
任务：解析卡资源（可多条）。
status: available|invalid|used。sourceId 可匹配来源名。projectId 可匹配项目。
输出：
{"reply":"","items":[{"cardNo":"","cvv":"","expiry":"MM/YY","holder":"","amount":0,"usage":"","status":"available","sourceId":null,"sourceName":"","projectId":null,"projectName":"","notes":""}],"unresolved":[]}`;

    case "create_proxy":
      return `${common}
任务：解析代理（可多条）。
protocol: socks|http。ipType: static|dynamic。status: available|in_use|used|invalid。
输出：
{"reply":"","items":[{"protocol":"socks","ipType":"static","host":"","port":1080,"username":"","password":"","region":"","rotateUrl":"","status":"available","sourceId":null,"sourceName":"","projectId":null,"projectName":"","notes":""}],"unresolved":[]}`;

    case "create_email":
      return `${common}
任务：解析邮箱（可多条）。
providerKey 默认 mock。status: available|in_use|used|invalid。
输出：
{"reply":"","items":[{"address":"","password":"","providerKey":"mock","usage":"","status":"available","sourceId":null,"sourceName":"","projectId":null,"projectName":"","notes":""}],"unresolved":[]}`;
  }
}

export interface ParseEnvelope {
  reply: string;
  items: Record<string, unknown>[];
  unresolved: string[];
}

export function normalizeEnvelope(raw: unknown): ParseEnvelope {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.items)
    ? obj.items
    : Array.isArray(obj.entries)
      ? obj.entries
      : [];
  return {
    reply: typeof obj.reply === "string" ? obj.reply : "已解析",
    items: list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"),
    unresolved: Array.isArray(obj.unresolved)
      ? obj.unresolved.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function matchProject(
  projects: ProjectOption[],
  projectId: unknown,
  projectName?: unknown,
): ProjectOption | null {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const id = Number(projectId);
  if (byId.has(id)) return byId.get(id)!;
  if (typeof projectName === "string" && projectName.trim()) {
    const name = projectName.trim().toLowerCase();
    return (
      projects.find(
        (p) =>
          p.name.toLowerCase() === name ||
          p.code.toLowerCase() === name ||
          p.name.toLowerCase().includes(name) ||
          name.includes(p.name.toLowerCase()),
      ) ?? null
    );
  }
  return null;
}

export function matchSource(
  sources: SourceOption[],
  sourceId: unknown,
  sourceName?: unknown,
): SourceOption | null {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const id = Number(sourceId);
  if (byId.has(id)) return byId.get(id)!;
  if (typeof sourceName === "string" && sourceName.trim()) {
    const name = sourceName.trim().toLowerCase();
    return (
      sources.find(
        (s) => s.name.toLowerCase() === name || s.name.toLowerCase().includes(name),
      ) ?? null
    );
  }
  return null;
}

export function normalizeStatusPartner(v: unknown): string {
  if (typeof v !== "string") return "active";
  const s = v.trim().toLowerCase();
  if (isOneOf(PARTNER_STATUS, s)) return s;
  if (s.includes("暂停") || s === "paused") return "paused";
  if (s.includes("终止") || s.includes("结束") || s === "closed") return "closed";
  return "active";
}

export function normalizeStatusProject(v: unknown): string {
  if (typeof v !== "string") return "active";
  const s = v.trim().toLowerCase();
  if (isOneOf(PROJECT_STATUS, s)) return s;
  if (s.includes("暂停")) return "paused";
  if (s.includes("结束")) return "closed";
  if (s.includes("进行")) return "active";
  return "active";
}

export function normalizeResourceStatus(v: unknown): string {
  if (typeof v !== "string") return "available";
  const s = v.trim().toLowerCase();
  if (isOneOf(RESOURCE_STATUS, s)) return s;
  if (s.includes("异常") || s.includes("失效") || s === "invalid") return "invalid";
  if (s.includes("用完") || s === "used") return "used";
  if (s.includes("使用") || s === "in_use") return "in_use";
  if (s.includes("可用") || s === "available") return "available";
  return "available";
}

export function normalizeCardStatus(v: unknown): string {
  if (typeof v !== "string") return "available";
  const s = v.trim().toLowerCase();
  if (isOneOf(CARD_STATUS, s)) return s;
  if (s.includes("异常") || s === "invalid") return "invalid";
  if (s.includes("已用") || s === "used") return "used";
  return "available";
}

export function normalizeProtocol(v: unknown): string {
  if (typeof v === "string" && isOneOf(PROXY_PROTOCOL, v.trim().toLowerCase())) {
    return v.trim().toLowerCase();
  }
  if (typeof v === "string" && v.toLowerCase().includes("http")) return "http";
  return "socks";
}

export function normalizeIpType(v: unknown): string {
  if (typeof v === "string" && isOneOf(PROXY_IP_TYPE, v.trim().toLowerCase())) {
    return v.trim().toLowerCase();
  }
  if (typeof v === "string" && (v.includes("动态") || v.toLowerCase().includes("dynamic"))) {
    return "dynamic";
  }
  return "static";
}

export function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "是" || s === "启用";
  }
  return false;
}

export function parseKinds(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .map(String)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x === "email" || x === "proxy" || x === "card")
      .join(",");
  }
  if (typeof v === "string") {
    const parts = v.split(/[,，、/\s]+/).map((x) => x.trim().toLowerCase());
    const mapped = parts.map((p) => {
      if (p.includes("邮") || p === "email") return "email";
      if (p.includes("代理") || p.includes("ip") || p === "proxy") return "proxy";
      if (p.includes("卡") || p === "card") return "card";
      return p;
    });
    return [...new Set(mapped.filter((x) => x === "email" || x === "proxy" || x === "card"))].join(
      ",",
    );
  }
  return "";
}

export function canUseAction(role: Role, action: AssistantAction): boolean {
  if (role === ROLES.ADMIN) return true;
  return ACTION_META[action].roles.includes(role);
}

export function isFinanceKind(v: unknown): v is "income" | "cost" {
  return isOneOf(FINANCE_KIND, v);
}
