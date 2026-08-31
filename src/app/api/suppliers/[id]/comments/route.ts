import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const supplierId = parseId((await ctx.params).id);
  if (!supplierId) return badRequest("id 非法");

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!supplier) return notFound("供应商不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{ content: string }>;
  const content = (body.content ?? "").trim();
  if (!content) return badRequest("请填写评论");

  const item = await prisma.supplierComment.create({
    data: {
      supplierId,
      content,
      createdById: g.session.id,
      creatorName: g.session.displayName,
    },
    include: { createdBy: { select: { id: true, displayName: true } } },
  });
  return jsonItem("supplierComment", g.session.role, item);
}
