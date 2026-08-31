import { prisma } from "./db";
import { setSchedulable } from "./sub2-client";

/// 监测开关同步 sub2 账号 schedulable。自动调度的评级开关走 sub2-dispatch。
export async function syncSub2Channel(input: {
  sub2ChannelId?: number | null;
  sub2SiteId?: number | null;
  sub2AccountId?: number | null;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const accountId = input.sub2AccountId ?? input.sub2ChannelId;
  if (accountId == null || input.sub2SiteId == null) return { ok: true };
  const site = await prisma.sub2Site.findUnique({ where: { id: input.sub2SiteId } });
  if (!site?.apiKey) return { ok: true };
  return setSchedulable({ baseUrl: site.baseUrl, apiKey: site.apiKey }, accountId, input.enabled);
}
