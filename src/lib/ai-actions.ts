// AI 助手：操作类型、默认模板、系统提示与解析约定
import {
  FINANCE_KIND,
  FUND_CURRENCY,
  isOneOf,
  parseSupplierCategories,
  PARTNER_STATUS,
  PAY_CHANNEL,
  PROJECT_STATUS,
  SUPPLIER_CATEGORY,
  type PartyKind,
  type SupplierCategory,
} from "./enums";
import { todayStr } from "./format";
import { ROLES, type Role } from "./rbac";

export const ASSISTANT_ACTIONS = [
  "bookkeep",
  "create_project",
  "create_desk",
  "create_supplier",
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
    roles: [ROLES.FINANCE],
    template: `项目：【项目名称】
收入：【金额】【人民币/U】，【谁】通过【支付宝/微信/银行卡】转给【谁】，用途：【干啥】
成本：【金额】【人民币/U】，【谁】通过【支付宝/微信/银行卡】转给【谁】，用途：【干啥】

也可直接写：项目 XX 今天刘赛用支付宝转 300 给巴总进货，甲方张三微信转了 1000 给秋明`,
  },
  create_project: {
    id: "create_project",
    label: "新建项目",
    description: "创建项目",
    roles: [ROLES.ADMIN],
    template: `名称：【项目名称】
状态：进行中 / 暂停 / 已结束
说明：【做什么】`,
  },
  create_desk: {
    id: "create_desk",
    label: "新建需求",
    description: "下游需求，可挂一个或多个项目",
    roles: [ROLES.FINANCE],
    template: `需求名称：【客户代号】
归属销售：【文本，不必是系统账号】
所属项目：【项目名，多个用顿号分隔】
状态：合作中 / 暂停 / 已终止`,
  },
  create_supplier: {
    id: "create_supplier",
    label: "新建供应商",
    description: "名字、业务分类、联系方式和可提供的货",
    roles: [ROLES.FINANCE],
    template: `名称：【供应商名】
业务分类：【GPT / Claude / AWS / 卡网，可多选】
微信号：【人脉供应商】
Telegram：【卡网常用，可空】
网站：【卡网链接，可空】
可以提供的货 / 产品：【如 Claude 官key、Visa 虚拟卡】`,
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

export interface SupplierOption {
  id: number;
  name: string;
  wechat?: string;
  goods?: string;
  category?: string;
}

export interface PartyOption {
  id: number;
  name: string;
}

function projectListText(projects: ProjectOption[]): string {
  if (!projects.length) return "（当前没有项目）";
  return projects.map((p) => `- id=${p.id} code=${p.code} name=${p.name}`).join("\n");
}

function supplierListText(suppliers: SupplierOption[]): string {
  if (!suppliers.length) return "（当前没有供货方）";
  return suppliers
    .map((s) => `- id=${s.id} name=${s.name} category=${s.category || "-"} wechat=${s.wechat || "-"} goods=${s.goods || "-"}`)
    .join("\n");
}

function yesterdayStr(): string {
  const t = new Date(`${todayStr()}T00:00:00Z`).getTime() - 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function partyListText(kind: string, rows: PartyOption[]): string {
  if (!rows.length) return `（当前没有${kind}）`;
  return rows.map((p) => `- id=${p.id} name=${p.name}`).join("\n");
}

export function buildSystemPrompt(
  action: AssistantAction,
  projects: ProjectOption[],
  suppliers: SupplierOption[] = [],
  members: PartyOption[] = [],
  partners: PartyOption[] = [],
): string {
  const common = `你是中转利润管理中台的操作助手。只输出 JSON（不要 markdown）。
今天: ${todayStr()}（Asia/Shanghai）
昨天: ${yesterdayStr()}
可用项目：
${projectListText(projects)}
可用供货方：
${supplierListText(suppliers)}
可用团队成员：
${partyListText("团队成员", members)}
可用合作伙伴：
${partyListText("合作伙伴", partners)}
`;

  switch (action) {
    case "bookkeep":
      return `${common}
任务：把用户口述整理成项目收支流水。
规则：
- kind 只能是 income 或 cost。amount 为正数。entryDate 为 YYYY-MM-DD。
- projectId 必须来自可用项目；匹配不到写 unresolved。
- currency 只能是 cny（人民币）或 usdt（U）。没说默认 cny。
- channel 只能是 alipay / wechat / bank。分别对应支付宝、微信、银行卡。没说就 unresolved。
- fromKind/toKind 只能是 member（团队成员）或 partner（合作伙伴）。
- fromId/toId 必须来自对应名单；用姓名匹配。匹配不到写 unresolved。
- 成本默认：成员转给伙伴。收入默认：伙伴转给成员。用户说了以用户为准。
- note 写这笔钱是干啥的。
- 收入：costSource 固定 self，supplierId 为 null。
- 成本若点名供货方：costSource=supplier 并填 supplierId；否则 costSource=self。
输出：
{"reply":"中文说明","items":[{"projectId":1,"projectName":"","kind":"cost","amount":100,"currency":"cny","channel":"alipay","fromKind":"member","fromId":1,"fromName":"","toKind":"partner","toId":1,"toName":"","entryDate":"${todayStr()}","note":"用途","costSource":"self","supplierId":null,"supplierName":""}],"unresolved":[]}`;

    case "create_project":
      return `${common}
任务：解析要创建的项目（可多条）。
status 只能是 active|paused|closed。不要输出负责人。
输出：
{"reply":"","items":[{"name":"","status":"active","description":""}],"unresolved":[]}`;

    case "create_desk":
      return `${common}
任务：解析要创建的需求（可多条）。
status: active|paused|closed。
projectIds 为所属项目 id 数组，必须来自可用项目，至少一个。
ownerName 为归属销售，自由文本。
输出：
{"reply":"","items":[{"name":"","ownerName":"","projectIds":[1],"projectNames":[""],"status":"active"}],"unresolved":[]}`;

    case "create_supplier":
      return `${common}
任务：解析要创建的供应商（可多条）。
category 为 gpt/claude/aws/cardshop 数组，可多选。卡网对应 cardshop。
wechat 为微信号；contact 为 Telegram；baseUrl 为网站。人脉供应商通常只有微信；卡网通常有网站和 TG。
输出：
{"reply":"","items":[{"name":"","category":["claude"],"wechat":"","contact":"","baseUrl":"","goods":""}],"unresolved":[]}`;
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

export function matchSupplier(
  suppliers: SupplierOption[],
  supplierId: unknown,
  supplierName?: unknown,
): SupplierOption | null {
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const id = Number(supplierId);
  if (byId.has(id)) return byId.get(id)!;
  if (typeof supplierName === "string" && supplierName.trim()) {
    const name = supplierName.trim().toLowerCase();
    return (
      suppliers.find(
        (s) => s.name.toLowerCase() === name || s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()),
      ) ?? null
    );
  }
  return null;
}

export function normalizeSupplierCategories(v: unknown): SupplierCategory[] {
  const parsed = parseSupplierCategories(v);
  if (parsed.length) return parsed;
  if (typeof v !== "string") return [];
  const s = v.toLowerCase();
  return SUPPLIER_CATEGORY.filter((c) => {
    if (c === "gpt") return s.includes("gpt") || s.includes("openai") || s.includes("chatgpt");
    if (c === "claude") return s.includes("claude") || s.includes("anthropic");
    if (c === "aws") return s.includes("aws") || s.includes("amazon");
    if (c === "cardshop") return s.includes("卡网") || s.includes("cardshop") || s.includes("visa");
    return false;
  });
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

export function canUseAction(role: Role, action: AssistantAction): boolean {
  if (role === ROLES.ADMIN) return true;
  return ACTION_META[action].roles.includes(role);
}

export function isFinanceKind(v: unknown): v is "income" | "cost" {
  return isOneOf(FINANCE_KIND, v);
}

export function matchParty(
  members: PartyOption[],
  partners: PartyOption[],
  kind: unknown,
  id: unknown,
  name?: unknown,
): { kind: PartyKind; id: number; name: string } | null {
  const n = typeof name === "string" ? name.trim().toLowerCase() : "";
  const pick = (list: PartyOption[], k: PartyKind) => {
    const byId = Number(id);
    if (Number.isInteger(byId) && byId > 0) {
      const hit = list.find((p) => p.id === byId);
      if (hit) return { kind: k, id: hit.id, name: hit.name };
    }
    if (!n) return null;
    const hit =
      list.find((p) => p.name.toLowerCase() === n) ??
      list.find((p) => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()));
    return hit ? { kind: k, id: hit.id, name: hit.name } : null;
  };
  if (kind === "member" || kind === "团队成员") return pick(members, "member");
  if (kind === "partner" || kind === "合作伙伴") return pick(partners, "partner");
  return pick(members, "member") ?? pick(partners, "partner");
}

export function normalizeCurrency(v: unknown): "cny" | "usdt" {
  if (typeof v !== "string") return "cny";
  const s = v.trim().toLowerCase();
  if (isOneOf(FUND_CURRENCY, s)) return s;
  if (s.includes("u") || s.includes("刀") || s.includes("美元") || s.includes("usdt")) return "usdt";
  return "cny";
}

export function normalizeChannel(v: unknown): "alipay" | "wechat" | "bank" | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (isOneOf(PAY_CHANNEL, s)) return s;
  if (s.includes("支付宝") || s.includes("alipay") || s.includes("zfb")) return "alipay";
  if (s.includes("微信") || s.includes("wechat") || s.includes("wx")) return "wechat";
  if (s.includes("银行") || s.includes("银行卡") || s.includes("bank")) return "bank";
  return null;
}
