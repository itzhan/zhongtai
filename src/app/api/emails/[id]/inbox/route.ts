import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { getProvider } from "@/lib/mailproviders";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 一键获取收件箱 —— 按邮箱的 providerKey 路由到对应插件。
/// 加新的接码类型不需要改这个 handler。
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const email = await prisma.emailResource.findUnique({ where: { id } });
  if (!email) return notFound("邮箱不存在");

  const provider = getProvider(email.providerKey);
  if (!provider) return badRequest(`未找到接码插件「${email.providerKey}」`);

  const cfgRow = await prisma.emailProviderConfig.findUnique({
    where: { providerKey: email.providerKey },
  });
  if (cfgRow && !cfgRow.enabled) return badRequest("该接码插件已停用");

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(cfgRow?.configJson ?? "{}");
  } catch {
    return NextResponse.json({ error: "接码插件配置不是合法 JSON" }, { status: 500 });
  }

  const { limit } = (await req.json().catch(() => ({}))) as { limit?: number };
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);

  try {
    const items = await provider.fetchInbox(
      { address: email.address, password: email.password, config },
      { limit: safeLimit },
    );
    return NextResponse.json({ items });
  } catch (e) {
    // 502: 失败来自外部服务而不是本站
    return NextResponse.json(
      { error: `获取收件箱失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
