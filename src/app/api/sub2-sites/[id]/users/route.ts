import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { listUsers } from "@/lib/sub2-client";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const site = await prisma.sub2Site.findUnique({ where: { id } });
  if (!site) return notFound("中台不存在");
  if (!site.apiKey) return badRequest("请先填写管理员 API Key");

  const search = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const r = await listUsers(
    { baseUrl: site.baseUrl, apiKey: site.apiKey },
    { search: search || undefined, page_size: 50, maxPages: search ? 10 : 2 },
  );
  if (!r.ok) return badRequest(r.error);
  return Response.json({ items: r.items });
}
