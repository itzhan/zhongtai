import { NextResponse } from "next/server";
import { badRequest, requireAdminFresh, requireRole } from "@/lib/guard";
import {
  AI_CHANNEL_PRESETS,
  getAiPublicConfig,
  upsertAiConfig,
  type AiChannel,
} from "@/lib/ai-config";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 读配置：记账相关角色可读（密钥脱敏）；presets 一并返回方便设置页
export async function GET() {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const config = await getAiPublicConfig();
  return NextResponse.json({
    item: config,
    presets: AI_CHANNEL_PRESETS,
  });
}

export async function PUT(req: Request) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    channel: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    enabled: boolean;
    temperature: number;
    clearApiKey: boolean;
  }>;

  if (body.channel !== undefined) {
    if (!["custom", "deepseek", "openai"].includes(body.channel)) {
      return badRequest("渠道非法");
    }
  }
  if (body.temperature !== undefined) {
    const t = Number(body.temperature);
    if (!Number.isFinite(t) || t < 0 || t > 2) return badRequest("temperature 应在 0~2");
  }

  await upsertAiConfig({
    channel: body.channel as AiChannel | undefined,
    baseUrl: body.baseUrl,
    model: body.model,
    apiKey: body.apiKey,
    enabled: body.enabled,
    temperature: body.temperature,
    clearApiKey: body.clearApiKey,
  });

  return NextResponse.json({ item: await getAiPublicConfig() });
}
