import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canSeeCustomer } from "@/lib/customer";
import { parsePeriod, periodRange, resourceProfit, splitUsage } from "@/lib/customer-profit";
import { FIELDS } from "@/lib/fields";
import { badRequest, forbidden, notFound, parseId, requireRole } from "@/lib/guard";
import { hasRole, ROLES } from "@/lib/rbac";
import { getPlatformUsage, getUsageStats } from "@/lib/sub2-client";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sub2Site: { select: { id: true, baseUrl: true, apiKey: true } },
      resources: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  if (!customer) return notFound("客户不存在");
  if (!canSeeCustomer(g.session.role, customer.ownerId, g.session.id)) {
    return forbidden("无权查看他人的客户");
  }

  const period = parsePeriod(new URL(req.url).searchParams.get("period"));
  const range = periodRange(period);
  const bound = Boolean(customer.sub2SiteId && customer.sub2UserId && customer.sub2Site?.apiKey);
  let usageUsd = 0;
  let actualCostUsd = 0;
  let accountCostUsd = 0;
  let totalRequests = 0;
  let totalTokens = 0;
  let byPlatform: Record<string, number> = {};
  let message: string | undefined;

  if (!bound) {
    message = customer.sub2UserId ? "中台未填写管理员 Key" : "尚未绑定 sub2 用户";
  } else {
    const site = { baseUrl: customer.sub2Site!.baseUrl, apiKey: customer.sub2Site!.apiKey };
    const stats = await getUsageStats(site, {
      userId: customer.sub2UserId!,
      startDate: range.start,
      endDate: range.end,
    });
    if (!stats.ok) return badRequest(stats.error);
    usageUsd = stats.item.totalCost;
    actualCostUsd = stats.item.totalActualCost;
    accountCostUsd = stats.item.totalAccountCost;
    totalRequests = stats.item.totalRequests;
    totalTokens = stats.item.totalTokens;
    byPlatform = { ...stats.item.byPlatform };
    if (range.window) {
      const platforms = await getPlatformUsage(site, customer.sub2UserId!, range.window);
      if (platforms.ok) {
        for (const row of platforms.items) {
          if (row.usageUsd > 0 && byPlatform[row.platform] == null) byPlatform[row.platform] = row.usageUsd;
        }
      }
    }
  }

  const usageMap = splitUsage(usageUsd, byPlatform, customer.resources);
  if (
    bound &&
    usageUsd > 0 &&
    customer.resources.length > 1 &&
    customer.resources.every((row) => !row.platform) &&
    [...usageMap.values()].every((n) => n === 0)
  ) {
    message = "多条资源都没指定平台，消耗只显示在合计里，请给资源选 GPT / Claude 等平台才能拆开算";
  }
  const showCost = hasRole(g.session.role, FIELDS.cost);
  const showProfit = hasRole(g.session.role, FIELDS.profit);

  let income = 0;
  let cost = 0;
  const resources = customer.resources.map((row) => {
    const calc = resourceProfit(row, usageMap.get(row.id) ?? 0);
    income += calc.income;
    cost += calc.cost;
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      usageUsd: calc.usageUsd,
      income: calc.income,
      cost: showCost ? calc.cost : null,
      profit: showProfit ? calc.profit : null,
    };
  });

  return NextResponse.json({
    item: {
      period,
      start: range.start,
      end: range.end,
      bound,
      message,
      usageUsd,
      actualCostUsd: showCost ? actualCostUsd : null,
      accountCostUsd: showCost ? accountCostUsd : null,
      totalRequests,
      totalTokens,
      income,
      cost: showCost ? cost : null,
      profit: showProfit ? income - cost : null,
      resources,
    },
  });
}
