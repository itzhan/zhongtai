// 利润聚合 —— 全系统唯一的公式定义处。
//
//   revenue = Σ FinanceEntry.amount  where kind = income
//   cost    = Σ FinanceEntry.amount  where kind = cost
//   profit  = revenue − cost
//
// 旧口径（台子卖价 / 采购表 / 供货进货）不再参与项目利润。
// 台子 newapi/sub2api 消耗接入后若要计入, 在本文件扩展。
import { prisma } from "./db";
import { todayStr } from "./format";

export interface ProjectProfit {
  projectId: number;
  revenue: number;
  cost: number;
  profit: number;
  /// profit / revenue; revenue 为 0 时给 0 而不是 NaN
  margin: number;
}

export interface DailyProfitPoint {
  date: string;
  label: string;
  income: number;
  cost: number;
  profit: number;
}

function assemble(projectId: number, revenue: number, cost: number): ProjectProfit {
  const profit = revenue - cost;
  return {
    projectId,
    revenue,
    cost,
    profit,
    margin: revenue === 0 ? 0 : profit / revenue,
  };
}

export async function projectProfit(projectId: number): Promise<ProjectProfit> {
  const rows = await prisma.financeEntry.groupBy({
    by: ["kind"],
    where: { projectId, deletedAt: null },
    _sum: { amount: true },
  });

  let revenue = 0;
  let cost = 0;
  for (const r of rows) {
    const sum = r._sum.amount ?? 0;
    if (r.kind === "income") revenue = sum;
    else if (r.kind === "cost") cost = sum;
  }
  return assemble(projectId, revenue, cost);
}

/// 一次算完所有项目 —— 仪表盘和项目列表用, 避免 N+1 次查询。
export async function allProjectProfits(): Promise<Map<number, ProjectProfit>> {
  const rows = await prisma.financeEntry.groupBy({
    by: ["projectId", "kind"],
    where: { deletedAt: null },
    _sum: { amount: true },
  });

  const revenue = new Map<number, number>();
  const cost = new Map<number, number>();
  for (const r of rows) {
    const sum = r._sum.amount ?? 0;
    if (r.kind === "income") revenue.set(r.projectId, (revenue.get(r.projectId) ?? 0) + sum);
    else if (r.kind === "cost") cost.set(r.projectId, (cost.get(r.projectId) ?? 0) + sum);
  }

  const ids = new Set([...revenue.keys(), ...cost.keys()]);
  const out = new Map<number, ProjectProfit>();
  for (const id of ids) {
    out.set(id, assemble(id, revenue.get(id) ?? 0, cost.get(id) ?? 0));
  }
  return out;
}

/// 近 N 天（含今天）的业务日序列, Asia/Shanghai 自然日字符串。
function recentDays(n: number, end = todayStr()): string[] {
  const base = new Date(`${end}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
  );
}

/// 项目逐日利润。默认近 30 天, 无流水的日期补 0。
export async function projectDailyProfit(
  projectId: number,
  days = 30,
): Promise<DailyProfitPoint[]> {
  const range = recentDays(Math.min(Math.max(days, 7), 90));
  const since = range[0];
  const until = range[range.length - 1];

  const rows = await prisma.financeEntry.findMany({
    where: {
      projectId,
      deletedAt: null,
      entryDate: { gte: since, lte: until },
    },
    select: { kind: true, amount: true, entryDate: true },
  });

  const byDate = new Map<string, { income: number; cost: number }>();
  for (const d of range) byDate.set(d, { income: 0, cost: 0 });

  for (const r of rows) {
    const bucket = byDate.get(r.entryDate);
    if (!bucket) continue;
    if (r.kind === "income") bucket.income += r.amount;
    else if (r.kind === "cost") bucket.cost += r.amount;
  }

  return range.map((date) => {
    const { income, cost } = byDate.get(date)!;
    return {
      date,
      label: date.slice(5), // MM-DD
      income,
      cost,
      profit: income - cost,
    };
  });
}
