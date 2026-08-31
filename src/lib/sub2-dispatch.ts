import { prisma } from "./db";
import { isOneOf, MONITOR_KIND, monitorPlatform, type DispatchAction, type MonitorGrade, type MonitorKind } from "./enums";
import { rateForKind } from "./monitor-goods";
import { scoreMonitor } from "./monitor-score";
import {
  getAccount,
  recoverAccount,
  setSchedulable,
  updateAccount,
  type Sub2Account,
  type Sub2SiteAuth,
} from "./sub2-client";

const SPREAD = [10, 20, 50, 100];

type SiteRow = {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string;
  hysteresis: number;
  escalateAfterMin: number;
  loadFactorStep: number;
  maxLoadFactor: number;
  concurrencyStep: number;
  maxConcurrency: number;
};

type MonitorRow = {
  id: number;
  name: string;
  kind: string;
  enabled: boolean;
  sub2SiteId: number | null;
  sub2AccountId: number | null;
  lastDispatchGrade: string;
  dispatchGradeStreak: number;
  originPriority: number | null;
  originConcurrency: number | null;
  originLoadFactor: number | null;
  lastLatencyMs: number | null;
  supplier: { goodsItems: { id: number; name: string; rate: string }[] };
  samples: { status: string }[];
};

const g = globalThis as typeof globalThis & {
  __dispatchIdle?: Map<string, number>;
};

function idleMap() {
  if (!g.__dispatchIdle) g.__dispatchIdle = new Map();
  return g.__dispatchIdle;
}

function asKind(v: string): MonitorKind {
  return isOneOf(MONITOR_KIND, v) ? v : "openai";
}

function auth(site: SiteRow): Sub2SiteAuth {
  return { baseUrl: site.baseUrl, apiKey: site.apiKey };
}

async function log(input: {
  siteId: number;
  monitorId?: number | null;
  accountId: number;
  action: DispatchAction;
  grade?: string;
  concurrency?: number | null;
  currentInUse?: number | null;
  detail: string;
  ok: boolean;
}) {
  await prisma.sub2DispatchLog.create({
    data: {
      siteId: input.siteId,
      monitorId: input.monitorId ?? null,
      accountId: input.accountId,
      action: input.action,
      grade: input.grade ?? "",
      concurrency: input.concurrency ?? null,
      currentInUse: input.currentInUse ?? null,
      detail: input.detail,
      ok: input.ok,
    },
  });
}

function desiredSchedulable(grade: MonitorGrade): boolean | null {
  if (grade === "excellent") return true;
  if (grade === "unstable" || grade === "unavailable") return false;
  return null;
}

function sortExcellent<T extends { monitor: MonitorRow; score: ReturnType<typeof scoreMonitor>; rate: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ar = a.rate ?? Number.POSITIVE_INFINITY;
    const br = b.rate ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const aFail = a.score.total ? a.score.down / a.score.total : 1;
    const bFail = b.score.total ? b.score.down / b.score.total : 1;
    if (aFail !== bFail) return aFail - bFail;
    const aSlow = a.score.total ? a.score.slow / a.score.total : 1;
    const bSlow = b.score.total ? b.score.slow / b.score.total : 1;
    if (aSlow !== bSlow) return aSlow - bSlow;
    return (a.monitor.lastLatencyMs ?? 1e9) - (b.monitor.lastLatencyMs ?? 1e9);
  });
}

function assignPriorities(sorted: { rate: number | null }[]): number[] {
  const out: number[] = [];
  let rank = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0) {
      const prev = sorted[i - 1].rate ?? Number.POSITIVE_INFINITY;
      const cur = sorted[i].rate ?? Number.POSITIVE_INFINITY;
      if (cur !== prev) rank += 1;
    }
    out.push(rank);
  }
  return out;
}

function nextSpread(current: number): number | null {
  return SPREAD.find((n) => n > current) ?? null;
}

async function snapshotOrigin(monitor: MonitorRow, acc: Sub2Account) {
  if (monitor.originPriority != null && monitor.originConcurrency != null) return;
  await prisma.supplierMonitor.update({
    where: { id: monitor.id },
    data: {
      originPriority: monitor.originPriority ?? acc.priority,
      originConcurrency: monitor.originConcurrency ?? acc.concurrency,
      originLoadFactor: monitor.originLoadFactor ?? acc.load_factor,
    },
  });
}

async function dispatchSite(site: SiteRow) {
  if (!site.apiKey) return;
  const monitors = (await prisma.supplierMonitor.findMany({
    where: { sub2SiteId: site.id, sub2AccountId: { not: null } },
    include: {
      supplier: { select: { goodsItems: { select: { id: true, name: true, rate: true } } } },
      samples: { orderBy: { checkedAt: "asc" }, take: 24 },
    },
  })) as unknown as MonitorRow[];

  const live = new Map<number, Sub2Account>();
  for (const m of monitors) {
    const id = m.sub2AccountId;
    if (id == null) continue;
    const r = await getAccount(auth(site), id);
    if (!r.ok) {
      await log({
        siteId: site.id,
        monitorId: m.id,
        accountId: id,
        action: "pause",
        detail: `读取账号失败：${r.error}`,
        ok: false,
      });
      continue;
    }
    live.set(id, r.item);
    await snapshotOrigin(m, r.item);
  }

  const scored = monitors
    .filter((m) => m.sub2AccountId != null && live.has(m.sub2AccountId))
    .map((m) => {
      const score = scoreMonitor(m.samples);
      return {
        monitor: m,
        score,
        rate: rateForKind(asKind(m.kind), m.supplier.goodsItems),
        acc: live.get(m.sub2AccountId!)!,
      };
    });

  const hysteresis = Math.max(1, site.hysteresis);

  for (const row of scored) {
    const grade = row.score.grade;
    const same = row.monitor.lastDispatchGrade === grade;
    const streak = same ? row.monitor.dispatchGradeStreak + 1 : 1;
    await prisma.supplierMonitor.update({
      where: { id: row.monitor.id },
      data: { lastDispatchGrade: grade, dispatchGradeStreak: streak },
    });
    row.monitor.lastDispatchGrade = grade;
    row.monitor.dispatchGradeStreak = streak;
    if (streak < hysteresis) continue;
    if (!row.monitor.enabled) continue;

    const want = desiredSchedulable(grade);
    if (want == null) continue;

    if (want && row.acc.status === "error") {
      const rec = await recoverAccount(auth(site), row.acc.id);
      await log({
        siteId: site.id,
        monitorId: row.monitor.id,
        accountId: row.acc.id,
        action: "recover",
        grade,
        currentInUse: row.acc.current_concurrency,
        detail: rec.ok ? "账号处于 error，已尝试恢复" : `恢复失败：${rec.error}`,
        ok: rec.ok,
      });
      if (rec.ok) row.acc.status = "active";
    }

    if (want === row.acc.schedulable) continue;
    const r = await setSchedulable(auth(site), row.acc.id, want);
    row.acc.schedulable = want;
    await log({
      siteId: site.id,
      monitorId: row.monitor.id,
      accountId: row.acc.id,
      action: want ? "resume" : "pause",
      grade,
      currentInUse: row.acc.current_concurrency,
      detail: r.ok ? (want ? "评级连续优秀，打开调度" : "评级连续不稳定/不可用，关闭调度") : `写入失败：${r.error}`,
      ok: r.ok,
    });
  }

  const platforms = ["openai", "anthropic"] as const;
  const idle = idleMap();

  for (const platform of platforms) {
    const group = scored.filter((row) => monitorPlatform(asKind(row.monitor.kind)) === platform);
    const excellent = sortExcellent(group.filter((row) => row.score.grade === "excellent" && row.acc.schedulable));
    const priorities = assignPriorities(excellent);

    for (let i = 0; i < excellent.length; i += 1) {
      const row = excellent[i];
      const want = priorities[i];
      if (row.acc.priority === want) continue;
      const r = await updateAccount(auth(site), row.acc.id, { priority: want });
      if (r.ok) row.acc.priority = want;
      await log({
        siteId: site.id,
        monitorId: row.monitor.id,
        accountId: row.acc.id,
        action: "set_priority",
        grade: row.score.grade,
        currentInUse: row.acc.current_concurrency,
        detail: r.ok ? `倍率 ${row.rate ?? "-"}，priority ${want}` : `写入失败：${r.error}`,
        ok: r.ok,
      });
    }

    const key = `${site.id}:${platform}`;
    const cheapest = excellent[0];
    if (!cheapest) {
      idle.delete(key);
      continue;
    }
    const siteHasTraffic = group.some((row) => row.acc.current_concurrency > 0);
    const inversion =
      cheapest.acc.current_concurrency <= 0 && excellent.slice(1).some((row) => row.acc.current_concurrency > 0);
    if (!siteHasTraffic || !inversion) {
      idle.delete(key);
      continue;
    }
    const ticks = (idle.get(key) ?? 0) + 1;
    idle.set(key, ticks);
    if (ticks < Math.max(1, site.escalateAfterMin)) continue;
    idle.set(key, 0);

    const step = await escalate(site, cheapest, excellent);
    if (step) {
      await log({
        siteId: site.id,
        monitorId: cheapest.monitor.id,
        accountId: cheapest.acc.id,
        action: step.action,
        grade: cheapest.score.grade,
        concurrency: cheapest.acc.concurrency,
        currentInUse: cheapest.acc.current_concurrency,
        detail: step.detail,
        ok: step.ok,
      });
    }
  }
}

async function escalate(
  site: SiteRow,
  cheapest: { monitor: MonitorRow; acc: Sub2Account; rate: number | null },
  excellent: { monitor: MonitorRow; acc: Sub2Account }[],
): Promise<{ action: DispatchAction; detail: string; ok: boolean } | null> {
  if (!cheapest.acc.schedulable) {
    const r = await setSchedulable(auth(site), cheapest.acc.id, true);
    cheapest.acc.schedulable = r.ok;
    return { action: "resume", detail: "加码前先打开调度", ok: r.ok };
  }
  if (cheapest.acc.priority !== 0) {
    const r = await updateAccount(auth(site), cheapest.acc.id, { priority: 0 });
    if (r.ok) cheapest.acc.priority = 0;
    return { action: "set_priority", detail: "加码：把最便宜号 priority 调到 0", ok: r.ok };
  }

  const othersAtZero = excellent.filter((row) => row.acc.id !== cheapest.acc.id && row.acc.priority <= 0);
  if (othersAtZero.length) {
    const r = await updateAccount(auth(site), othersAtZero[0].acc.id, { priority: 1 });
    if (r.ok) othersAtZero[0].acc.priority = 1;
    return { action: "set_priority", detail: `加码：把更贵号 ${othersAtZero[0].acc.name} 拉开到 priority 1`, ok: r.ok };
  }

  const currentLf = cheapest.acc.load_factor ?? 0;
  if (currentLf < site.maxLoadFactor) {
    const next = Math.min(site.maxLoadFactor, Math.max(currentLf, 0) + Math.max(1, site.loadFactorStep));
    const r = await updateAccount(auth(site), cheapest.acc.id, { load_factor: next });
    if (r.ok) cheapest.acc.load_factor = next;
    return { action: "set_load_factor", detail: `加码：load_factor ${currentLf || "空"} → ${next}`, ok: r.ok };
  }

  const cap = cheapest.acc.concurrency;
  const atCap = cap > 0 && cheapest.acc.current_concurrency >= cap;
  if (atCap && cap < site.maxConcurrency) {
    const next = Math.min(site.maxConcurrency, cap + Math.max(1, site.concurrencyStep));
    const r = await updateAccount(auth(site), cheapest.acc.id, { concurrency: next });
    if (r.ok) cheapest.acc.concurrency = next;
    return { action: "set_concurrency", detail: `加码：concurrency ${cap} → ${next}`, ok: r.ok };
  }

  const busyExpensive = excellent.find((row) => row.acc.id !== cheapest.acc.id && row.acc.current_concurrency > 0);
  if (busyExpensive) {
    const from = busyExpensive.acc.priority;
    const next = nextSpread(from);
    if (next != null) {
      const r = await updateAccount(auth(site), busyExpensive.acc.id, { priority: next });
      if (r.ok) busyExpensive.acc.priority = next;
      return {
        action: "set_priority",
        detail: `加码：更贵号 ${busyExpensive.acc.name} 仍在吃量，priority ${from} → ${next}`,
        ok: r.ok,
      };
    }
  }

  return {
    action: "set_load_factor",
    detail: "已顶满仍无流量（粘性会话、模型白名单或未绑定号可能在抢）",
    ok: true,
  };
}

export async function runDispatch() {
  const sites = await prisma.sub2Site.findMany({ where: { enabled: true } });
  for (const site of sites) {
    try {
      await dispatchSite(site);
    } catch (e) {
      console.error(`[dispatch] 台子 ${site.name} 失败`, e);
    }
  }
}

export async function snapshotBoundAccount(site: SiteRow | Sub2SiteAuth, monitorId: number, accountId: number) {
  const r = await getAccount(site, accountId);
  if (!r.ok) return r;
  await prisma.supplierMonitor.update({
    where: { id: monitorId },
    data: {
      originPriority: r.item.priority,
      originConcurrency: r.item.concurrency,
      originLoadFactor: r.item.load_factor,
    },
  });
  return r;
}
