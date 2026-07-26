import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/guard";
import { allProjectProfits } from "@/lib/profit";
import { ROLES, type Role } from "@/lib/rbac";
import { fmtMoneyShort, todayStr } from "@/lib/format";

export const runtime = "nodejs";

/// 仪表盘【由后端按角色组装好卡片】再返回, 而不是把原始数据吐给前端筛。
/// 这样脱敏天然到位: 销售拿到的响应体里根本不出现 cost / profit 这两个
/// key —— 不是 null, 是压根没组装进去。
interface StatCardData {
  key: string;
  label: string;
  value: string;
  hint?: string;
  accent: "primary" | "success" | "danger" | "warning" | "default";
  icon: string;
  positiveIsGood?: boolean;
}

/// 近 N 天的业务日 (Asia/Shanghai), 从早到晚。
function recentDays(n: number): string[] {
  const today = todayStr();
  const base = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
  );
}

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const role = g.session.role as Role;
  const isAdmin = role === ROLES.ADMIN;
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 30, 7), 90);
  const range = recentDays(days);
  const since = range[0];

  const seeMoney = isAdmin || role === ROLES.FINANCE;
  const seeSales = isAdmin || role === ROLES.SALES || role === ROLES.FINANCE;
  const seeProduction = isAdmin || role === ROLES.PRODUCTION || role === ROLES.FINANCE;
  const seeResource = isAdmin || role === ROLES.RESOURCE || role === ROLES.FINANCE;

  const [projects, products, profits] = await Promise.all([
    prisma.project.findMany({ select: { id: true, code: true, name: true, status: true } }),
    prisma.product.findMany({ select: { id: true, name: true, status: true, capacity: true } }),
    seeMoney ? allProjectProfits() : Promise.resolve(null),
  ]);

  const cards: StatCardData[] = [];
  const blocks: Record<string, unknown> = {};

  // ── 产品情况: 所有角色都看 ──────────────────────────────────
  blocks.products = products.slice(0, 12);
  cards.push({
    key: "products",
    label: "在售产品",
    value: String(products.length),
    hint: `${projects.filter((p) => p.status === "active").length} 个进行中项目`,
    accent: "default",
    icon: "package",
  });

  // ── 台子情况 ────────────────────────────────────────────────
  if (seeSales) {
    const mine = role === ROLES.SALES ? { ownerId: g.session.id } : {};
    const desks = await prisma.desk.findMany({
      where: mine,
      include: {
        owner: { select: { displayName: true } },
        project: { select: { name: true } },
        items: { select: { quantity: true, unitPrice: true } },
      },
      orderBy: { id: "desc" },
    });

    const gmv = desks.reduce(
      (s, d) => s + d.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0),
      0,
    );

    cards.push({
      key: "desks",
      label: role === ROLES.SALES ? "我的台子" : "台子总数",
      value: String(desks.length),
      hint: `${desks.filter((d) => d.status === "active").length} 个合作中`,
      accent: "primary",
      icon: "store",
    });
    cards.push({
      key: "gmv",
      label: "台子卖价合计",
      value: fmtMoneyShort(gmv),
      accent: "success",
      icon: "wallet",
    });

    blocks.desks = desks.slice(0, 8).map((d) => ({
      id: d.id,
      name: d.name,
      owner: d.owner.displayName,
      project: d.project.name,
      itemCount: d.items.length,
      amount: d.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0),
    }));
  }

  // ── 生产情况 ────────────────────────────────────────────────
  if (seeProduction) {
    const [batches, pendingRequests] = await Promise.all([
      prisma.productionBatch.findMany({
        where: { batchDate: { gte: since } },
        include: { product: { select: { name: true } } },
      }),
      prisma.resourceRequest.count({ where: { status: "pending" } }),
    ]);

    const qty = batches.reduce((s, b) => s + b.quantity, 0);

    cards.push({
      key: "batches",
      label: `近 ${days} 天产出批次`,
      value: String(batches.length),
      accent: "primary",
      icon: "factory",
    });
    cards.push({
      key: "output",
      label: "产出总量",
      value: qty.toLocaleString("en-US"),
      hint: pendingRequests ? `${pendingRequests} 张申报待处理` : undefined,
      accent: "success",
      icon: "boxes",
    });

    // 按产品汇总产出, 取前 6
    const byProduct = new Map<string, number>();
    for (const b of batches) {
      byProduct.set(b.product.name, (byProduct.get(b.product.name) ?? 0) + b.quantity);
    }
    blocks.output = [...byProduct.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  // ── 资源情况 ────────────────────────────────────────────────
  if (seeResource) {
    const [cardCount, proxyCount, emailCount, sourceCount, monthPurchase] = await Promise.all([
      prisma.cardResource.count({ where: { status: "available" } }),
      prisma.proxyResource.count({ where: { status: "available" } }),
      prisma.emailResource.count({ where: { status: "available" } }),
      prisma.resourceSource.count({ where: { active: true } }),
      prisma.purchase.aggregate({
        where: { purchaseDate: { gte: since } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    cards.push({
      key: "resources",
      label: "可用资源",
      value: String(cardCount + proxyCount + emailCount),
      hint: `邮箱 ${emailCount} · IP ${proxyCount} · 卡 ${cardCount}`,
      accent: "default",
      icon: "boxes",
    });
    cards.push({
      key: "purchase",
      label: `近 ${days} 天采购`,
      value: fmtMoneyShort(monthPurchase._sum.totalAmount ?? 0),
      hint: `${monthPurchase._count} 笔 · ${sourceCount} 个来源`,
      accent: "warning",
      icon: "cart",
      positiveIsGood: false,
    });

    blocks.resources = {
      email: emailCount,
      proxy: proxyCount,
      card: cardCount,
      sources: sourceCount,
    };
  }

  // ── 钱: 只有财务和管理员 ────────────────────────────────────
  if (seeMoney && profits) {
    const totals = [...profits.values()].reduce(
      (acc, p) => ({
        revenue: acc.revenue + p.revenue,
        cost: acc.cost + p.cost,
        profit: acc.profit + p.profit,
      }),
      { revenue: 0, cost: 0, profit: 0 },
    );
    const margin = totals.revenue === 0 ? 0 : totals.profit / totals.revenue;

    // 钱的卡片放最前面
    cards.unshift(
      {
        key: "revenue",
        label: "总营收",
        value: fmtMoneyShort(totals.revenue),
        accent: "success",
        icon: "trending",
      },
      {
        key: "cost",
        label: "总成本",
        value: fmtMoneyShort(totals.cost),
        accent: "warning",
        icon: "receipt",
        positiveIsGood: false,
      },
      {
        key: "profit",
        label: "净利润",
        value: fmtMoneyShort(totals.profit),
        hint: `利润率 ${(margin * 100).toFixed(1)}%`,
        accent: totals.profit >= 0 ? "primary" : "danger",
        icon: "wallet",
      },
    );

    blocks.projectProfits = projects
      .map((p) => {
        const pf = profits.get(p.id);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          revenue: pf?.revenue ?? 0,
          cost: pf?.cost ?? 0,
          profit: pf?.profit ?? 0,
          margin: pf?.margin ?? 0,
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }

  return NextResponse.json({
    item: { role, days, cards: cards.slice(0, 8), blocks },
  });
}
