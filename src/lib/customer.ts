import { Prisma } from "@prisma/client";
import { COST_MODE, CUSTOMER_PLATFORM, isOneOf, PARTNER_STATUS, SELL_MODE } from "./enums";
import { FIELDS } from "./fields";
import { USDT_CNY_RATE } from "./format";
import { hasRole, ROLES, type Role } from "./rbac";

export const CUSTOMER_INCLUDE = {
  owner: { select: { id: true, displayName: true } },
  sub2Site: { select: { id: true, name: true, baseUrl: true } },
  resources: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.CustomerInclude;

export function canSeeCustomer(role: Role, ownerId: number, sessionId: number) {
  return role !== ROLES.SALES || ownerId === sessionId;
}

export function withoutCost<T extends Record<string, unknown>>(role: Role, data: T): T {
  if (hasRole(role, FIELDS.cost)) return data;
  const next = { ...data };
  delete next.costMode;
  delete next.costFixedAmount;
  delete next.costUnitPrice;
  return next;
}

function asFinite(v: unknown, fallback: number): number | null {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type ResourceInput = {
  name: string;
  platform: string;
  sellMode: string;
  discount: number;
  fxRate: number;
  sellUnitPrice: number;
  costMode: string;
  costFixedAmount: number;
  costUnitPrice: number;
  note: string;
  sortOrder: number;
};

export function parseResourceBody(
  body: Record<string, unknown>,
  partial: boolean,
): { error: string } | ResourceInput {
  const name = body.name === undefined ? undefined : String(body.name).trim();
  if (!partial && !name) return { error: "请填写资源名称" };
  if (partial && body.name !== undefined && !name) return { error: "资源名称不能为空" };

  const platformRaw = body.platform === undefined ? undefined : String(body.platform).trim().toLowerCase();
  if (platformRaw !== undefined && platformRaw !== "" && !isOneOf(CUSTOMER_PLATFORM, platformRaw)) {
    return { error: "平台非法" };
  }

  const sellMode = body.sellMode === undefined ? (partial ? undefined : "discount") : String(body.sellMode);
  if (sellMode !== undefined && !isOneOf(SELL_MODE, sellMode)) return { error: "卖价类型非法" };

  const costMode = body.costMode === undefined ? (partial ? undefined : "api") : String(body.costMode);
  if (costMode !== undefined && !isOneOf(COST_MODE, costMode)) return { error: "成本类型非法" };

  let discount: number | undefined;
  if (body.zhe !== undefined) {
    const zhe = asFinite(body.zhe, NaN);
    if (zhe == null || zhe < 0 || zhe > 10) return { error: "折扣请填 0-10 折" };
    discount = zhe / 10;
  } else if (body.discount !== undefined) {
    const n = asFinite(body.discount, NaN);
    if (n == null || n < 0 || n > 2) return { error: "折扣倍率非法" };
    discount = n;
  }

  const fxRate = body.fxRate === undefined ? undefined : asFinite(body.fxRate, NaN);
  if (fxRate !== undefined && (fxRate == null || fxRate <= 0)) return { error: "汇率非法" };

  const sellUnitPrice = body.sellUnitPrice === undefined ? undefined : asFinite(body.sellUnitPrice, NaN);
  if (sellUnitPrice !== undefined && (sellUnitPrice == null || sellUnitPrice < 0)) return { error: "卖价单价非法" };

  const costFixedAmount = body.costFixedAmount === undefined ? undefined : asFinite(body.costFixedAmount, NaN);
  if (costFixedAmount !== undefined && (costFixedAmount == null || costFixedAmount < 0)) return { error: "固定成本非法" };

  const costUnitPrice = body.costUnitPrice === undefined ? undefined : asFinite(body.costUnitPrice, NaN);
  if (costUnitPrice !== undefined && (costUnitPrice == null || costUnitPrice < 0)) return { error: "成本单价非法" };

  const sortOrder = body.sortOrder === undefined ? undefined : asFinite(body.sortOrder, NaN);
  if (sortOrder !== undefined && (sortOrder == null || !Number.isInteger(sortOrder))) return { error: "排序非法" };

  if (!partial) {
    return {
      name: name ?? "",
      platform: platformRaw ?? "",
      sellMode: sellMode ?? "discount",
      discount: discount ?? 1,
      fxRate: fxRate ?? USDT_CNY_RATE,
      sellUnitPrice: sellUnitPrice ?? 0,
      costMode: costMode ?? "api",
      costFixedAmount: costFixedAmount ?? 0,
      costUnitPrice: costUnitPrice ?? 0,
      note: String(body.note ?? ""),
      sortOrder: sortOrder ?? 0,
    };
  }

  return {
    name: name ?? "",
    platform: platformRaw ?? "",
    sellMode: sellMode ?? "discount",
    discount: discount ?? 1,
    fxRate: fxRate ?? USDT_CNY_RATE,
    sellUnitPrice: sellUnitPrice ?? 0,
    costMode: costMode ?? "api",
    costFixedAmount: costFixedAmount ?? 0,
    costUnitPrice: costUnitPrice ?? 0,
    note: body.note === undefined ? "" : String(body.note),
    sortOrder: sortOrder ?? 0,
  };
}

export function resourcePatch(
  body: Record<string, unknown>,
): { error: string } | { data: Prisma.CustomerResourceUpdateInput } {
  const parsed = parseResourceBody(body, true);
  if ("error" in parsed) return parsed;
  const data: Prisma.CustomerResourceUpdateInput = {};
  if (body.name !== undefined) data.name = parsed.name;
  if (body.platform !== undefined) data.platform = parsed.platform;
  if (body.sellMode !== undefined) data.sellMode = parsed.sellMode;
  if (body.zhe !== undefined || body.discount !== undefined) data.discount = parsed.discount;
  if (body.fxRate !== undefined) data.fxRate = parsed.fxRate;
  if (body.sellUnitPrice !== undefined) data.sellUnitPrice = parsed.sellUnitPrice;
  if (body.costMode !== undefined) data.costMode = parsed.costMode;
  if (body.costFixedAmount !== undefined) data.costFixedAmount = parsed.costFixedAmount;
  if (body.costUnitPrice !== undefined) data.costUnitPrice = parsed.costUnitPrice;
  if (body.note !== undefined) data.note = parsed.note;
  if (body.sortOrder !== undefined) data.sortOrder = parsed.sortOrder;
  return { data };
}

export function parseStatus(v: unknown): string | { error: string } | undefined {
  if (v === undefined) return undefined;
  const s = String(v);
  if (!isOneOf(PARTNER_STATUS, s)) return { error: "状态非法" };
  return s;
}

export function parseBinding(body: {
  sub2SiteId?: number | null;
  sub2UserId?: number | null;
  sub2UserName?: string;
  sub2UserEmail?: string;
}):
  | { error: string }
  | { skip: true }
  | { sub2SiteId: number | null; sub2UserId: number | null; sub2UserName: string; sub2UserEmail: string } {
  if (body.sub2SiteId === undefined && body.sub2UserId === undefined) return { skip: true };
  const siteId = body.sub2SiteId == null || body.sub2SiteId === 0 ? null : Number(body.sub2SiteId);
  const userId = body.sub2UserId == null || body.sub2UserId === 0 ? null : Number(body.sub2UserId);
  if ((siteId == null) !== (userId == null)) return { error: "中台和用户需要一起绑定" };
  if (siteId != null && (!Number.isInteger(siteId) || siteId <= 0)) return { error: "中台不合法" };
  if (userId != null && (!Number.isInteger(userId) || userId <= 0)) return { error: "用户 id 不合法" };
  return {
    sub2SiteId: siteId,
    sub2UserId: userId,
    sub2UserName: siteId ? String(body.sub2UserName ?? "").trim() : "",
    sub2UserEmail: siteId ? String(body.sub2UserEmail ?? "").trim() : "",
  };
}
