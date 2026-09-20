// 客户利润 —— 按资源行的卖价/成本口径，用 sub2 消耗实时算。
// 不写 FinanceEntry，也不进项目利润。
import { USDT_CNY_RATE, todayStr } from "./format";

export interface CustomerPricing {
  sellMode: string;
  discount: number;
  fxRate: number;
  sellUnitPrice: number;
  costMode: string;
  costFixedAmount: number;
  costUnitPrice: number;
}

/// 收入（人民币）。折扣：消耗USD × 汇率 × 折扣；固定单价：消耗USD × 人民币单价。
export function resourceIncome(row: CustomerPricing, usageUsd: number): number {
  if (row.sellMode === "unit") return usageUsd * (row.sellUnitPrice || 0);
  const fx = row.fxRate > 0 ? row.fxRate : USDT_CNY_RATE;
  return usageUsd * fx * (row.discount || 0);
}

/// 成本（人民币）。固定记账是定额；API 自动是消耗USD × 人民币单价。
export function resourceCost(row: CustomerPricing, usageUsd: number): number {
  if (row.costMode === "api") return usageUsd * (row.costUnitPrice || 0);
  return row.costFixedAmount || 0;
}

export function resourceProfit(row: CustomerPricing, usageUsd: number) {
  const income = resourceIncome(row, usageUsd);
  const cost = resourceCost(row, usageUsd);
  return { usageUsd, income, cost, profit: income - cost };
}

/// 把总消耗拆到各资源。只有一条资源时整笔算它；有平台用量就按平台对上。
export function splitUsage<T extends { id: number; platform: string }>(
  totalUsd: number,
  byPlatform: Record<string, number>,
  resources: T[],
): Map<number, number> {
  const out = new Map<number, number>();
  if (resources.length === 0) return out;
  if (resources.length === 1) {
    out.set(resources[0].id, totalUsd);
    return out;
  }

  let allocated = 0;
  const assigned = new Set<number>();
  for (const row of resources) {
    const key = row.platform.trim().toLowerCase();
    if (!key) continue;
    const usd = byPlatform[key];
    if (usd == null) continue;
    out.set(row.id, usd);
    assigned.add(row.id);
    allocated += usd;
  }

  const rest = resources.filter((row) => !assigned.has(row.id));
  const leftover = Math.max(0, totalUsd - allocated);
  if (rest.length === 1) {
    out.set(rest[0].id, leftover);
  } else if (rest.length > 1 && leftover > 0 && assigned.size > 0) {
    const each = leftover / rest.length;
    for (const row of rest) out.set(row.id, each);
  } else {
    for (const row of rest) out.set(row.id, 0);
  }
  for (const row of resources) if (!out.has(row.id)) out.set(row.id, 0);
  return out;
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + delta));
  return dt.toISOString().slice(0, 10);
}

export type UsagePeriod = "month" | "7d" | "30d";

export function periodRange(period: string, end = todayStr()): { start: string; end: string; window: "daily" | "weekly" | "monthly" | null } {
  if (period === "7d") return { start: shiftDay(end, -6), end, window: "weekly" };
  if (period === "30d") return { start: shiftDay(end, -29), end, window: "monthly" };
  return { start: `${end.slice(0, 8)}01`, end, window: "monthly" };
}

export function parsePeriod(v: unknown): UsagePeriod {
  if (v === "7d" || v === "30d" || v === "month") return v;
  return "month";
}
