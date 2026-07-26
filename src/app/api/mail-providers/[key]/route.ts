import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, requireRoleFresh } from "@/lib/guard";
import { getProvider } from "@/lib/mailproviders";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const { key } = await ctx.params;
  const provider = getProvider(key);
  if (!provider) return notFound("接码插件不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    label: string;
    enabled: boolean;
    config: Record<string, string>;
  }>;

  const existing = await prisma.emailProviderConfig.findUnique({ where: { providerKey: key } });
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(existing?.configJson ?? "{}");
  } catch {
    current = {};
  }

  // 只接受该 provider 声明过的字段。secret 字段收到掩码占位符时保留原值 ——
  // GET 从不回传真实密钥, 所以前端原样提交时不能把它当成新值写进去。
  const next = { ...current };
  for (const f of provider.configFields) {
    const v = body.config?.[f.name];
    if (v === undefined) continue;
    if (f.secret && v === "********") continue;
    next[f.name] = v;
  }

  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return badRequest("enabled 必须是布尔值");
  }

  const item = await prisma.emailProviderConfig.upsert({
    where: { providerKey: key },
    update: {
      configJson: JSON.stringify(next),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
    create: {
      providerKey: key,
      label: body.label ?? provider.label,
      enabled: body.enabled ?? true,
      configJson: JSON.stringify(next),
    },
  });

  return NextResponse.json({
    item: { key: item.providerKey, label: item.label, enabled: item.enabled },
  });
}
