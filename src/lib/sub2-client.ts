const TIMEOUT_MS = 15_000;

function proxyUrl(): string {
  return (process.env.MONITOR_PROXY || "").trim();
}

async function siteFetch(url: string, init: RequestInit) {
  const proxy = proxyUrl();
  if (!proxy) return fetch(url, init);
  const undici = await import(/* webpackIgnore: true */ "undici");
  const dispatcher = new undici.ProxyAgent(proxy);
  return undici.fetch(url, { ...init, dispatcher: dispatcher as never } as never);
}

export type Sub2SiteAuth = {
  baseUrl: string;
  apiKey: string;
};

export function publicSite<T extends { apiKey: string }>(row: T) {
  const { apiKey, ...rest } = row;
  return { ...rest, hasApiKey: Boolean(apiKey) };
}

export type Sub2Account = {
  id: number;
  name: string;
  platform: string;
  type: string;
  status: string;
  schedulable: boolean;
  priority: number;
  concurrency: number;
  current_concurrency: number;
  load_factor: number | null;
  group_ids: number[];
  error_message: string | null;
};

type Envelope<T> = { code: number; message?: string; data: T };

function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export async function sub2Request<T>(
  site: Sub2SiteAuth,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const url = `${normalizeBase(site.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await siteFetch(url, {
      method: init.method ?? "GET",
      headers: {
        "x-api-key": site.apiKey,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: Envelope<T> | null = null;
    try {
      json = text ? (JSON.parse(text) as Envelope<T>) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.message || text.slice(0, 200) || `HTTP ${res.status}`;
      return { ok: false, error: msg, status: res.status };
    }
    if (!json || json.code !== 0) {
      return { ok: false, error: json?.message || "sub2api 返回异常", status: res.status };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "连接超时" : e.message) : "请求失败";
    return { ok: false, error: msg, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function asAccount(raw: Record<string, unknown>): Sub2Account {
  const load = raw.load_factor;
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    platform: String(raw.platform ?? ""),
    type: String(raw.type ?? ""),
    status: String(raw.status ?? ""),
    schedulable: Boolean(raw.schedulable),
    priority: Number(raw.priority ?? 50),
    concurrency: Number(raw.concurrency ?? 0),
    current_concurrency: Number(raw.current_concurrency ?? raw.current_in_use ?? 0),
    load_factor: load == null || load === "" ? null : Number(load),
    group_ids: Array.isArray(raw.group_ids) ? raw.group_ids.map(Number) : [],
    error_message: raw.error_message == null ? null : String(raw.error_message),
  };
}

export async function listAccounts(
  site: Sub2SiteAuth,
  query: { platform?: string; search?: string; page_size?: number } = {},
): Promise<{ ok: true; items: Sub2Account[] } | { ok: false; error: string }> {
  const items: Sub2Account[] = [];
  let page = 1;
  const pageSize = query.page_size ?? 100;
  for (;;) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort_by: "id",
      sort_order: "asc",
    });
    if (query.platform) params.set("platform", query.platform);
    if (query.search) params.set("search", query.search);
    const r = await sub2Request<{ items?: unknown[]; pages?: number }>(site, `/api/v1/admin/accounts?${params}`);
    if (!r.ok) return r;
    const batch = (r.data.items ?? []).map((row) => asAccount(row as Record<string, unknown>));
    items.push(...batch);
    const pages = Number(r.data.pages ?? 1);
    if (page >= pages || batch.length < pageSize) break;
    page += 1;
    if (page > 20) break;
  }
  return { ok: true, items };
}

export async function getAccount(
  site: Sub2SiteAuth,
  id: number,
): Promise<{ ok: true; item: Sub2Account } | { ok: false; error: string }> {
  const r = await sub2Request<Record<string, unknown>>(site, `/api/v1/admin/accounts/${id}`);
  if (!r.ok) return r;
  return { ok: true, item: asAccount(r.data) };
}

export async function setSchedulable(
  site: Sub2SiteAuth,
  id: number,
  schedulable: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await sub2Request(site, `/api/v1/admin/accounts/${id}/schedulable`, {
    method: "POST",
    body: { schedulable },
  });
  if (!r.ok) return r;
  return { ok: true };
}

export async function updateAccount(
  site: Sub2SiteAuth,
  id: number,
  body: { priority?: number; concurrency?: number; load_factor?: number; status?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await sub2Request(site, `/api/v1/admin/accounts/${id}`, { method: "PUT", body });
  if (!r.ok) return r;
  return { ok: true };
}

export async function recoverAccount(
  site: Sub2SiteAuth,
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const recovered = await sub2Request(site, `/api/v1/admin/accounts/${id}/recover-state`, { method: "POST" });
  if (recovered.ok) return { ok: true };
  const cleared = await sub2Request(site, `/api/v1/admin/accounts/${id}/clear-error`, { method: "POST" });
  if (!cleared.ok) return cleared;
  return { ok: true };
}

export type ConcurrencySnap = { current: number; max: number };

export async function readConcurrency(
  site: Sub2SiteAuth,
  accountIds: number[],
): Promise<Map<number, ConcurrencySnap>> {
  const out = new Map<number, ConcurrencySnap>();
  const ops = await sub2Request<{
    enabled?: boolean;
    account?: Record<string, { current_in_use?: number; max_capacity?: number }>;
  }>(site, "/api/v1/admin/ops/concurrency");
  if (ops.ok && ops.data.enabled !== false && ops.data.account) {
    for (const id of accountIds) {
      const row = ops.data.account[String(id)];
      if (!row) continue;
      out.set(id, { current: Number(row.current_in_use ?? 0), max: Number(row.max_capacity ?? 0) });
    }
  }
  const missing = accountIds.filter((id) => !out.has(id));
  for (const id of missing) {
    const r = await getAccount(site, id);
    if (r.ok) out.set(id, { current: r.item.current_concurrency, max: r.item.concurrency });
  }
  return out;
}
