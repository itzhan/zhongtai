import { prisma } from "./db";

function parseIntField(v: unknown, min: number, max: number, fallback?: number) {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

const STRATEGY = {
  hysteresis: [1, 10, 2],
  escalateAfterMin: [1, 30, 3],
  loadFactorStep: [1, 1000, 10],
  maxLoadFactor: [1, 10000, 100],
  concurrencyStep: [1, 100, 5],
  maxConcurrency: [1, 1000, 50],
} as const;

export function parseSiteBody(
  body: Record<string, unknown>,
  partial: boolean,
): { error: string } | { data: Record<string, unknown> } {
  const name = body.name === undefined ? undefined : String(body.name).trim();
  const baseUrl = body.baseUrl === undefined ? undefined : String(body.baseUrl).trim().replace(/\/+$/, "");
  const apiKey = body.apiKey === undefined ? undefined : String(body.apiKey).trim();
  if (!partial) {
    if (!name) return { error: "请填写名称" as const };
    if (!baseUrl) return { error: "请填写 sub2 地址" as const };
    if (!apiKey) return { error: "请填写管理员 API Key" as const };
  } else {
    if (body.name !== undefined && !name) return { error: "请填写名称" as const };
    if (body.baseUrl !== undefined && !baseUrl) return { error: "请填写 sub2 地址" as const };
  }

  const data: Record<string, unknown> = {};
  for (const [key, [min, max, fallback]] of Object.entries(STRATEGY)) {
    const parsed = parseIntField(body[key], min, max, partial ? undefined : fallback);
    if (parsed === null) return { error: "策略数字不合法" as const };
    if (parsed !== undefined) data[key] = parsed;
  }
  if (name !== undefined) data.name = name;
  if (baseUrl !== undefined) data.baseUrl = baseUrl;
  if (apiKey) data.apiKey = apiKey;
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  return { data };
}

export const SUB2_SITE_INCLUDE = {
  _count: { select: { monitors: true } },
  logs: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

export function parseBinding(
  body: { sub2SiteId?: number | null; sub2AccountId?: number | null },
  existing?: { sub2SiteId: number | null; sub2AccountId: number | null },
): { error: string } | { sub2SiteId?: number | null; sub2AccountId?: number | null } {
  const hasSite = body.sub2SiteId !== undefined;
  const hasAcc = body.sub2AccountId !== undefined;
  if (!hasSite && !hasAcc) return {};
  const siteId = hasSite
    ? body.sub2SiteId == null || body.sub2SiteId === 0
      ? null
      : Number(body.sub2SiteId)
    : (existing?.sub2SiteId ?? null);
  const accountId = hasAcc
    ? body.sub2AccountId == null || body.sub2AccountId === 0
      ? null
      : Number(body.sub2AccountId)
    : (existing?.sub2AccountId ?? null);
  if ((siteId == null) !== (accountId == null)) return { error: "台子和账号需要一起绑定" as const };
  if (siteId != null && (!Number.isInteger(siteId) || siteId <= 0)) return { error: "台子不合法" as const };
  if (accountId != null && (!Number.isInteger(accountId) || accountId <= 0)) return { error: "账号 id 不合法" as const };
  return { sub2SiteId: siteId, sub2AccountId: accountId };
}

export async function assertAccountFree(siteId: number, accountId: number, exceptMonitorId?: number) {
  const clash = await prisma.supplierMonitor.findFirst({
    where: {
      sub2SiteId: siteId,
      sub2AccountId: accountId,
      ...(exceptMonitorId ? { id: { not: exceptMonitorId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (clash) return `该账号已绑定渠道「${clash.name}」`;
  return null;
}
