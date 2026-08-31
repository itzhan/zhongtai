import { prisma } from "./db";
import { defaultMonitorModel, isOneOf, MONITOR_KIND, type MonitorKind, type MonitorStatus } from "./enums";

const TIMEOUT_MS = 10_000;
const KEEP_SAMPLES = 48;
const RATE_LIMIT_RETRY_MS = 1_000;
const RATE_LIMIT_TRIES = 3;

function probeProxyUrl(): string {
  return (process.env.MONITOR_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || "").trim();
}

let proxyAgent: unknown = null;
let proxyAgentReady = false;

async function probeFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) {
  const proxy = probeProxyUrl();
  if (!proxy) return fetch(url, init);
  if (!proxyAgentReady) {
    const undici = await import(/* webpackIgnore: true */ "undici");
    proxyAgent = new undici.ProxyAgent(proxy);
    proxyAgentReady = true;
  }
  const undici = await import(/* webpackIgnore: true */ "undici");
  return undici.fetch(url, { ...init, dispatcher: proxyAgent as never });
}

export interface ProbeOutcome {
  status: Exclude<MonitorStatus, "unknown">;
  latencyMs: number;
  httpStatus: number | null;
  error: string;
}

function probeUrl(baseUrl: string, kind: MonitorKind): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (kind === "claude") {
    if (/\/messages$/i.test(trimmed)) return trimmed;
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/messages`;
    return `${trimmed}/v1/messages`;
  }
  if (kind === "openai_response") {
    if (/\/responses$/i.test(trimmed)) return trimmed;
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/responses`;
    return `${trimmed}/v1/responses`;
  }
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function redact(text: string, apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return text.slice(0, 240);
  return text.split(apiKey).join("<api-key>").slice(0, 240);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block === "object" && "text" in block) return String((block as { text?: string }).text ?? "");
      return "";
    })
    .join("");
}

function hasChatContent(payload: { choices?: unknown }): boolean {
  const choices = payload.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return false;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return textOf(message?.content).trim().length > 0;
}

function hasResponsesContent(payload: { output_text?: unknown; output?: unknown }): boolean {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return true;
  if (!Array.isArray(payload.output)) return false;
  return payload.output.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (!item || typeof item !== "object") return false;
    const row = item as { text?: unknown; content?: unknown };
    if (typeof row.text === "string" && row.text.trim()) return true;
    return textOf(row.content).trim().length > 0;
  });
}

function hasContent(payload: unknown, kind: MonitorKind): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (kind === "claude") {
    return textOf((payload as { content?: unknown }).content).trim().length > 0;
  }
  if (kind === "openai_response") {
    return hasResponsesContent(payload as { output_text?: unknown; output?: unknown });
  }
  return hasChatContent(payload as { choices?: unknown });
}

function jsonHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...extra,
  };
}

function buildRequest(kind: MonitorKind, apiKey: string, model: string): { headers: Record<string, string>; body: string } {
  if (kind === "claude") {
    return {
      headers: jsonHeaders(apiKey, { "anthropic-version": "2023-06-01", ...(apiKey ? { "x-api-key": apiKey } : {}) }),
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    };
  }
  if (kind === "openai_response") {
    return {
      headers: jsonHeaders(apiKey),
      body: JSON.stringify({
        model,
        input: "ping",
        max_output_tokens: 16,
        stream: false,
      }),
    };
  }
  return {
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    }),
  };
}

async function probeOnce(input: {
  kind: MonitorKind;
  url: string;
  apiKey: string;
  model: string;
  slowMs: number;
}): Promise<ProbeOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const req = buildRequest(input.kind, input.apiKey, input.model);

  try {
    const res = await probeFetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: req.headers,
      body: req.body,
    });
    const latencyMs = Date.now() - started;
    const raw = await res.text();
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (res.status === 401 || res.status === 403) {
      return { status: "down", latencyMs, httpStatus: res.status, error: "认证失败" };
    }
    if (res.status === 429) {
      return { status: "limited", latencyMs, httpStatus: res.status, error: "被限流" };
    }
    if (res.status === 451) {
      return { status: "down", latencyMs, httpStatus: res.status, error: "地区访问受限，探测需要代理" };
    }
    if (!res.ok) {
      let msg = raw || `HTTP ${res.status}`;
      if (json && typeof json === "object") {
        const err = (json as { error?: { message?: string } | string }).error;
        if (typeof err === "string" && err.trim()) msg = err;
        else if (err && typeof err === "object" && err.message) msg = err.message;
      }
      return {
        status: "down",
        latencyMs,
        httpStatus: res.status,
        error: redact(msg, input.apiKey) || `HTTP ${res.status}`,
      };
    }
    if (!hasContent(json, input.kind)) {
      return { status: "down", latencyMs, httpStatus: res.status, error: "HTTP 200 但响应无内容" };
    }
    if (latencyMs >= input.slowMs) {
      return { status: "slow", latencyMs, httpStatus: res.status, error: "" };
    }
    return { status: "up", latencyMs, httpStatus: res.status, error: "" };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      status: "down",
      latencyMs,
      httpStatus: null,
      error: aborted ? "探测超时" : redact(e instanceof Error ? e.message : String(e), input.apiKey),
    };
  } finally {
    clearTimeout(timer);
  }
}

/// 按格式打一发真实请求：Completions / Responses / Claude messages。
/// 429 会隔 1 秒再打，最多 3 次；仍限流记为 limited，不算异常。
export async function probeEndpoint(input: {
  kind: MonitorKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  slowMs: number;
}): Promise<ProbeOutcome> {
  const kind = isOneOf(MONITOR_KIND, input.kind) ? input.kind : "openai";
  const model = defaultMonitorModel(kind, input.model);
  const url = probeUrl(input.baseUrl, kind);
  let last: ProbeOutcome | null = null;
  for (let i = 0; i < RATE_LIMIT_TRIES; i += 1) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
    last = await probeOnce({ kind, url, apiKey: input.apiKey, model, slowMs: input.slowMs });
    if (last.status !== "limited") return last;
  }
  return last as ProbeOutcome;
}

export async function runEnabledMonitors() {
  const monitors = await prisma.supplierMonitor.findMany({
    where: { enabled: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const results = [];
  for (const monitor of monitors) {
    try {
      results.push(await runAndStore(monitor.id));
    } catch (e) {
      results.push({ id: monitor.id, lastError: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

export async function runAndStore(monitorId: number) {
  const monitor = await prisma.supplierMonitor.findUnique({ where: { id: monitorId } });
  if (!monitor) throw new Error("监测项不存在");
  const outcome = await probeEndpoint({
    kind: isOneOf(MONITOR_KIND, monitor.kind) ? monitor.kind : "openai",
    baseUrl: monitor.baseUrl,
    apiKey: monitor.apiKey,
    model: monitor.model,
    slowMs: monitor.slowMs,
  });
  const checkedAt = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.supplierMonitorSample.create({
      data: {
        monitorId,
        status: outcome.status,
        latencyMs: outcome.latencyMs,
        httpStatus: outcome.httpStatus,
        error: outcome.error,
        checkedAt,
      },
    }),
    prisma.supplierMonitor.update({
      where: { id: monitorId },
      data: {
        lastStatus: outcome.status,
        lastLatencyMs: outcome.latencyMs,
        lastError: outcome.error,
        lastCheckedAt: checkedAt,
      },
    }),
  ]);

  const extras = await prisma.supplierMonitorSample.findMany({
    where: { monitorId },
    orderBy: { checkedAt: "desc" },
    skip: KEEP_SAMPLES,
    select: { id: true },
  });
  if (extras.length) {
    await prisma.supplierMonitorSample.deleteMany({ where: { id: { in: extras.map((row) => row.id) } } });
  }
  return updated;
}
