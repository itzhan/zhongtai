import { badRequest, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { listAccounts } from "@/lib/sub2-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; baseUrl?: string };
  const apiKey = (body.apiKey ?? "").trim();
  const baseUrl = (body.baseUrl ?? "").trim();
  if (!apiKey) return badRequest("请填写管理员 API Key");
  if (!baseUrl) return badRequest("请填写 sub2 地址");
  const r = await listAccounts({ baseUrl, apiKey }, { page_size: 20 });
  if (!r.ok) return badRequest(r.error);
  return Response.json({
    ok: true,
    item: {
      accountCount: r.items.length,
      sample: r.items.slice(0, 5).map((a) => ({ id: a.id, name: a.name, platform: a.platform })),
    },
  });
}
