// AI 记账助手配置 —— 库内配置优先, 环境变量兜底。
import { prisma } from "./db";

export type AiChannel = "custom" | "deepseek" | "openai";

export interface AiRuntimeConfig {
  channel: AiChannel;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  temperature: number;
  source: "db" | "env" | "none";
}

export interface AiPublicConfig {
  channel: AiChannel;
  baseUrl: string;
  model: string;
  enabled: boolean;
  temperature: number;
  apiKeySet: boolean;
  source: "db" | "env" | "none";
  ready: boolean;
}

export const AI_CHANNEL_PRESETS: Record<
  Exclude<AiChannel, "custom">,
  { label: string; baseUrl: string; model: string; hint: string }
> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "便宜好用；模型名以控制台为准，可改成 deepseek-v4 等",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "官方 GPT；也可用兼容中转改 baseUrl",
  },
};

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseChannel(v: string | undefined | null): AiChannel {
  if (v === "deepseek" || v === "openai" || v === "custom") return v;
  return "custom";
}

function fromEnv(): AiRuntimeConfig | null {
  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL ?? "");
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const model = (process.env.AI_MODEL ?? "").trim();
  if (!baseUrl || !apiKey || !model) return null;
  return {
    channel: "custom",
    baseUrl,
    model,
    apiKey,
    enabled: true,
    temperature: 0.2,
    source: "env",
  };
}

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig | null> {
  const row = await prisma.aiProviderConfig.findUnique({ where: { key: "default" } });
  if (row?.enabled && row.baseUrl.trim() && row.apiKey.trim() && row.model.trim()) {
    return {
      channel: parseChannel(row.channel),
      baseUrl: normalizeBaseUrl(row.baseUrl),
      model: row.model.trim(),
      apiKey: row.apiKey.trim(),
      enabled: true,
      temperature: Number.isFinite(row.temperature) ? row.temperature : 0.2,
      source: "db",
    };
  }
  return fromEnv();
}

export async function getAiPublicConfig(): Promise<AiPublicConfig> {
  const row = await prisma.aiProviderConfig.findUnique({ where: { key: "default" } });
  if (row) {
    const dbReady = Boolean(
      row.enabled && row.baseUrl.trim() && row.apiKey.trim() && row.model.trim(),
    );
    const env = fromEnv();
    return {
      channel: parseChannel(row.channel),
      baseUrl: row.baseUrl,
      model: row.model,
      enabled: row.enabled,
      temperature: row.temperature,
      apiKeySet: Boolean(row.apiKey.trim()),
      source: "db",
      ready: dbReady || Boolean(env),
    };
  }
  const env = fromEnv();
  if (env) {
    return {
      channel: "custom",
      baseUrl: env.baseUrl,
      model: env.model,
      enabled: true,
      temperature: env.temperature,
      apiKeySet: true,
      source: "env",
      ready: true,
    };
  }
  return {
    channel: "custom",
    baseUrl: "",
    model: "",
    enabled: false,
    temperature: 0.2,
    apiKeySet: false,
    source: "none",
    ready: false,
  };
}

export async function upsertAiConfig(input: {
  channel?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  enabled?: boolean;
  temperature?: number;
  clearApiKey?: boolean;
}) {
  const existing = await prisma.aiProviderConfig.findUnique({ where: { key: "default" } });
  let apiKey = existing?.apiKey ?? "";
  if (input.clearApiKey) apiKey = "";
  else if (input.apiKey !== undefined && input.apiKey.trim() !== "") {
    apiKey = input.apiKey.trim();
  }

  const data = {
    channel: input.channel ?? existing?.channel ?? "custom",
    baseUrl: input.baseUrl !== undefined ? input.baseUrl.trim() : (existing?.baseUrl ?? ""),
    model: input.model !== undefined ? input.model.trim() : (existing?.model ?? ""),
    apiKey,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : (existing?.enabled ?? false),
    temperature:
      input.temperature !== undefined
        ? Math.min(2, Math.max(0, Number(input.temperature) || 0))
        : (existing?.temperature ?? 0.2),
  };

  return prisma.aiProviderConfig.upsert({
    where: { key: "default" },
    create: { key: "default", ...data },
    update: data,
  });
}
