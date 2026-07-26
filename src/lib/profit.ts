// 利润聚合 —— 全系统唯一的公式定义处。
//
//   revenue = Σ DeskItem.quantity × unitPrice          该项目下所有台子
//   cost    = Σ Purchase.totalAmount
//           + Σ SupplierItem.quantity × unitPrice       仅 quantity > 0
//   profit  = revenue − cost
//
// 供货方明细里 quantity = 0 表示「仅报价、尚未进货」, 报价不是成本 ——
// 否则录一个供应商报价, 利润就凭空掉一截。
import { prisma } from "./db";

export interface ProjectProfit {
  projectId: number;
  revenue: number;
  cost: number;
  /// 成本拆分, 供项目详情页展示构成
  purchaseCost: number;
  supplierCost: number;
  profit: number;
  /// profit / revenue; revenue 为 0 时给 0 而不是 NaN
  margin: number;
}

function assemble(
  projectId: number,
  revenue: number,
  purchaseCost: number,
  supplierCost: number,
): ProjectProfit {
  const cost = purchaseCost + supplierCost;
  const profit = revenue - cost;
  return {
    projectId,
    revenue,
    cost,
    purchaseCost,
    supplierCost,
    profit,
    margin: revenue === 0 ? 0 : profit / revenue,
  };
}

export async function projectProfit(projectId: number): Promise<ProjectProfit> {
  const [deskItems, purchaseAgg, supplierItems] = await Promise.all([
    prisma.deskItem.findMany({
      where: { desk: { projectId } },
      select: { quantity: true, unitPrice: true },
    }),
    prisma.purchase.aggregate({ where: { projectId }, _sum: { totalAmount: true } }),
    prisma.supplierItem.findMany({
      where: { supplier: { projectId }, quantity: { gt: 0 } },
      select: { quantity: true, unitPrice: true },
    }),
  ]);

  return assemble(
    projectId,
    deskItems.reduce((s, r) => s + r.quantity * r.unitPrice, 0),
    purchaseAgg._sum.totalAmount ?? 0,
    supplierItems.reduce((s, r) => s + r.quantity * r.unitPrice, 0),
  );
}

/// 一次算完所有项目 —— 仪表盘和项目列表用, 避免 N+1 次查询。
export async function allProjectProfits(): Promise<Map<number, ProjectProfit>> {
  const [deskItems, purchases, supplierItems] = await Promise.all([
    prisma.deskItem.findMany({
      select: { quantity: true, unitPrice: true, desk: { select: { projectId: true } } },
    }),
    prisma.purchase.groupBy({ by: ["projectId"], _sum: { totalAmount: true } }),
    prisma.supplierItem.findMany({
      where: { quantity: { gt: 0 } },
      select: { quantity: true, unitPrice: true, supplier: { select: { projectId: true } } },
    }),
  ]);

  const revenue = new Map<number, number>();
  const purchaseCost = new Map<number, number>();
  const supplierCost = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const r of deskItems) add(revenue, r.desk.projectId, r.quantity * r.unitPrice);
  for (const p of purchases) add(purchaseCost, p.projectId, p._sum.totalAmount ?? 0);
  for (const s of supplierItems) add(supplierCost, s.supplier.projectId, s.quantity * s.unitPrice);

  const ids = new Set([...revenue.keys(), ...purchaseCost.keys(), ...supplierCost.keys()]);
  const out = new Map<number, ProjectProfit>();
  for (const id of ids) {
    out.set(
      id,
      assemble(id, revenue.get(id) ?? 0, purchaseCost.get(id) ?? 0, supplierCost.get(id) ?? 0),
    );
  }
  return out;
}
