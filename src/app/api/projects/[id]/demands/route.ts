import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  product: { select: { id: true, name: true } },
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE, ROLES.PRODUCTION, ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, enableDemands: true },
  });
  if (!project) return notFound("项目不存在");
  if (!project.enableDemands) return badRequest("该项目未启用甲方需求清单");

  const items = await prisma.projectDemand.findMany({
    where: { projectId, deletedAt: null },
    include: INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return jsonItems("demand", g.session.role, items);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, enableDemands: true },
  });
  if (!project) return notFound("项目不存在");
  if (!project.enableDemands) return badRequest("该项目未启用甲方需求清单");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    productId: number | null;
    productName: string;
    spec: string;
    quantity: number | null;
    note: string;
    sortOrder: number;
  }>;

  let productName = (body.productName ?? "").trim();
  let productId: number | null = body.productId != null ? Number(body.productId) : null;

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) return badRequest("产品不存在");
    if (!productName) productName = product.name;
  }
  if (!productName) return badRequest("请填写货名");

  let quantity: number | null = null;
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== ("" as never)) {
    const q = Number(body.quantity);
    if (!Number.isFinite(q) || q < 0) return badRequest("数量非法");
    quantity = q;
  }

  const item = await prisma.projectDemand.create({
    data: {
      projectId,
      productId,
      productName,
      spec: body.spec ?? "",
      quantity,
      note: body.note ?? "",
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    },
    include: INCLUDE,
  });

  return jsonItem("demand", g.session.role, item);
}
