// AI 助手：操作类型、默认模板、系统提示与解析约定
import {
  FINANCE_KIND,
  isOneOf,
  parseSupplierCategories,
  PARTNER_STATUS,
  PROJECT_STATUS,
  SUPPLIER_CATEGORY,
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
    template: `请把下面内容整理成项目收支流水（可多条）：

项目：【填写项目名称】
今天收入：【金额】，说明：【来源】
今天成本：【金额】，类型：自产/供应商【供货方名】，说明：【用途】

（也可直接写：项目 XX 今天花了 300 给怪兽算力进货，回款 1000）`,
  },
  create_project: {
    id: "create_project",
    label: "新建项目",
    description: "创建项目",
    roles: [ROLES.ADMIN],
    template: `请创建项目：

名称：【项目名称】
状态：进行中 / 暂停 / 已结束
说明：【做什么】`,
  },
  create_desk: {
    id: "create_desk",
    label: "新建需求",
    description: "下游需求，可挂一个或多个项目",
    roles: [ROLES.FINANCE],
    template: `请创建需求：

需求名称：【客户代号】
归属销售：【随便填，不需要系统账号】
所属项目：【项目名，多个用顿号分隔】
状态：合作中 / 暂停 / 已终止`,
  },
  create_supplier: {
    id: "create_supplier",
    label: "新建供应商",
    description: "名字、业务分类、微信号、可以提供的货",
    roles: [ROLES.FINANCE],
    template: `请创建供应商：

名称：【供应商名】
业务分类：【GPT / Claude / AWS，可多选】
微信号：【可空】
可以提供的货：【如 Claude / Outlook】`,
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

export function buildSystemPrompt(
  action: AssistantAction,
  projects: ProjectOption[],
  suppliers: SupplierOption[] = [],
): string {
  const common = `你是中转利润管理中台的操作助手。只输出 JSON（不要 markdown）。
今天: ${todayStr()}（Asia/Shanghai）
昨天: ${yesterdayStr()}
可用项目：
${projectListText(projects)}
可用供货方：
${supplierListText(suppliers)}
`;

  switch (action) {
    case "bookkeep":
      return `${common}
任务：把用户口述整理成项目收支流水。
规则：
- kind 只能是 income 或 cost。amount 为正数。entryDate 为 YYYY-MM-DD。
- projectId 必须来自可用项目；匹配不到写 unresolved。
- 收入：costSource 固定 self，supplierId 为 null。
- 成本分两种：
  - 自产：costSource=self，supplierId 为 null。用户没提供货方时用这个。
  - 供应商：costSource=supplier，supplierId 必须来自可用供货方；匹配不到写 unresolved。
输出：
{"reply":"中文说明","items":[{"projectId":1,"projectName":"","kind":"cost","amount":100,"entryDate":"${todayStr()}","note":"说明","costSource":"self","supplierId":null,"supplierName":""}],"unresolved":[]}`;

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
只需要名字、业务分类、微信号、可以提供的货。不要项目、联系人、货明细。
category 为 gpt/claude/aws 数组，可多选。
输出：
{"reply":"","items":[{"name":"","category":["claude"],"wechat":"","goods":""}],"unresolved":[]}`;
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
