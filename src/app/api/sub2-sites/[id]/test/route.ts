import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { listAccounts } from "@/lib/sub2-client";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const existing = await prisma.sub2Site.findUnique({ where: { id } });
  if (!existing) return notFound("调度台子不存在");

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; baseUrl?: string };
  const apiKey = (body.apiKey ?? existing.apiKey).trim();
  const baseUrl = (body.baseUrl ?? existing.baseUrl).trim();
  if (!apiKey) return badRequest("请填写管理员 API Key");
  if (!baseUrl) return badRequest("请填写 sub2 地址");

  const r = await listAccounts({ baseUrl, apiKey }, { page_size: 20 });
  if (!r.ok) return badRequest(r.error);
  return Response.json({
    ok: true,
    item: { accountCount: r.items.length, sample: r.items.slice(0, 5).map((a) => ({ id: a.id, name: a.name, platform: a.platform })) },
  });
}
