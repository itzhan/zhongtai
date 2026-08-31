import { prisma } from "@/lib/db";
import { isOneOf, MONITOR_KIND, monitorPlatform, type MonitorKind } from "@/lib/enums";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { scoreMonitor } from "@/lib/monitor-score";
import { rateForKind } from "@/lib/monitor-goods";
import { ROLES } from "@/lib/rbac";
import { getAccount, listAccounts, publicSite, type Sub2Account } from "@/lib/sub2-client";

export const runtime = "nodejs";

function asKind(v: string): MonitorKind {
  return isOneOf(MONITOR_KIND, v) ? v : "openai";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const site = await prisma.sub2Site.findUnique({ where: { id } });
  if (!site) return notFound("调度台子不存在");

  const monitors = await prisma.supplierMonitor.findMany({
    where: { sub2SiteId: id },
    include: {
      supplier: { select: { id: true, name: true, goodsItems: { select: { id: true, name: true, rate: true } } } },
      samples: { orderBy: { checkedAt: "asc" }, take: 24 },
    },
    orderBy: { id: "asc" },
  });

  const boundIds = monitors.map((m) => m.sub2AccountId).filter((n): n is number => n != null);
  const accounts: Record<number, Sub2Account> = {};
  if (site.apiKey) {
    for (const accountId of boundIds) {
      const r = await getAccount({ baseUrl: site.baseUrl, apiKey: site.apiKey }, accountId);
      if (r.ok) accounts[accountId] = r.item;
    }
  }

  const bindings = monitors.map((m) => {
    const chronological = m.samples;
    return {
      id: m.id,
      name: m.name,
      kind: m.kind,
      enabled: m.enabled,
      sub2AccountId: m.sub2AccountId,
      supplier: { id: m.supplier.id, name: m.supplier.name },
      rate: rateForKind(asKind(m.kind), m.supplier.goodsItems),
      platform: monitorPlatform(asKind(m.kind)),
      score: scoreMonitor(chronological),
      account: m.sub2AccountId != null ? accounts[m.sub2AccountId] ?? null : null,
    };
  });

  let unbound: { id: number; name: string; platform: string; status: string; schedulable: boolean; priority: number }[] = [];
  if (site.apiKey) {
    const listed = await listAccounts({ baseUrl: site.baseUrl, apiKey: site.apiKey });
    if (listed.ok) {
      const bound = new Set(boundIds);
      unbound = listed.items
        .filter((a) => !bound.has(a.id))
        .map((a) => ({
          id: a.id,
          name: a.name,
          platform: a.platform,
          status: a.status,
          schedulable: a.schedulable,
          priority: a.priority,
        }));
    }
  }

  return Response.json({
    item: {
      site: publicSite(site),
      bindings,
      unbound,
    },
  });
}
