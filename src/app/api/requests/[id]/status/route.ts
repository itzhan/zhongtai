import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { isOneOf, REQUEST_STATUS } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  items: { include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
  project: { select: { id: true, code: true, name: true } },
  reporter: { select: { id: true, displayName: true } },
  handledBy: { select: { id: true, displayName: true } },
  purchases: { select: { id: true, totalAmount: true } },
} as const;

/// 审核流转。purchased 不在这里手动设 —— 它由 /purchase 生成采购单时
/// 自动回写, 避免出现「状态是已采购但没有采购记录」的悬空状态。
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.resourceRequest.findUnique({ where: { id } });
  if (!existing) return notFound("申报单不存在");

  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (!isOneOf(REQUEST_STATUS, status)) return badRequest("状态非法");
  if (status === "purchased") {
    return badRequest("请用「生成采购」来标记已采购");
  }

  const item = await prisma.resourceRequest.update({
    where: { id },
    data: { status, handledById: g.session.id, handledAt: new Date() },
    include: INCLUDE,
  });

  return jsonItem("request", g.session.role, item);
}
