import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/guard";
import { allProjectProfits } from "@/lib/profit";
import { ROLES, type Role } from "@/lib/rbac";
import { fmtMoneyShort, todayStr } from "@/lib/format";

export const runtime = "nodejs";

/// 仪表盘【由后端按角色组装】再返回。
/// 顶部卡片固定 4 项: 营收 / 成本 / 利润 / 项目数量（钱仅财务与管理员）。
/// 下方 blocks 仍按角色返回各业务概况。
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

  const [projects, products, profits, projectCount] = await Promise.all([
    prisma.project.findMany({ select: { id: true, code: true, name: true, status: true } }),
    prisma.product.findMany({ select: { id: true, name: true, status: true, capacity: true } }),
    seeMoney ? allProjectProfits() : Promise.resolve(null),
    prisma.project.count({ where: { deletedAt: null } }),
  ]);

  const cards: StatCardData[] = [];
  const blocks: Record<string, unknown> = {};

  // ── 顶部 4 卡: 营收 / 成本 / 利润 / 项目数量 ──────────────
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

    cards.push(
      {
        key: "revenue",
        label: "营收",
        value: fmtMoneyShort(totals.revenue),
        accent: "success",
        icon: "trending",
      },
      {
        key: "cost",
        label: "成本",
        value: fmtMoneyShort(totals.cost),
        accent: "warning",
        icon: "receipt",
        positiveIsGood: false,
      },
      {
        key: "profit",
        label: "利润",
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

  cards.push({
    key: "projects",
    label: "项目数量",
    value: String(projectCount),
    hint: `${projects.filter((p) => p.status === "active").length} 个进行中`,
    accent: "default",
    icon: "package",
  });

  // ── 产品情况: 所有角色 ──────────────────────────────────
  blocks.products = products.slice(0, 12);

  // ── 台子情况 ────────────────────────────────────────────
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

    blocks.desks = desks.slice(0, 8).map((d) => ({
      id: d.id,
      name: d.name,
      owner: d.owner.displayName,
      project: d.project.name,
      itemCount: d.items.length,
      amount: d.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0),
    }));
  }

  // ── 生产情况 ────────────────────────────────────────────
  if (seeProduction) {
    const batches = await prisma.productionBatch.findMany({
      where: {
        batchDate: { gte: since },
        ...(role === ROLES.PRODUCTION ? { operatorId: g.session.id } : {}),
      },
      include: { product: { select: { name: true } } },
    });

    const byProduct = new Map<string, number>();
    for (const b of batches) {
      byProduct.set(b.product.name, (byProduct.get(b.product.name) ?? 0) + b.quantity);
    }
    blocks.output = [...byProduct.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  // ── 资源情况 ────────────────────────────────────────────
  if (seeResource) {
    const [cardCount, proxyCount, emailCount, sourceCount] = await Promise.all([
      prisma.cardResource.count({ where: { status: "available" } }),
      prisma.proxyResource.count({ where: { status: "available" } }),
      prisma.emailResource.count({ where: { status: "available" } }),
      prisma.resourceSource.count({ where: { active: true } }),
    ]);

    blocks.resources = {
      email: emailCount,
      proxy: proxyCount,
      card: cardCount,
      sources: sourceCount,
    };
  }

  return NextResponse.json({
    item: { role, days, cards, blocks },
  });
}
