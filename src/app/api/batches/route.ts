import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  product: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  operator: { select: { id: true, displayName: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const g = await requireRole(ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const projectId = sp.get("projectId");
  const productId = sp.get("productId");
  const from = sp.get("from");
  const to = sp.get("to");

  const items = await prisma.productionBatch.findMany({
    where: {
      ...(projectId && projectId !== "all" ? { projectId: Number(projectId) } : {}),
      ...(productId && productId !== "all" ? { productId: Number(productId) } : {}),
      // batchDate 是 "YYYY-MM-DD" 文本, 字典序即时间序, 可以直接比较
      ...(from || to
        ? { batchDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ batchDate: "desc" }, { id: "desc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    projectId: number;
    productId: number;
    quantity: number;
    batchDate: string;
    operatorId: number;
    note: string;
  }>;

  if (!body.projectId) return badRequest("请选择归属项目");
  if (!body.productId) return badRequest("请选择产品");
  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("产出数量需大于 0");
  if (!body.batchDate || !DATE_RE.test(body.batchDate)) return badRequest("生产日期格式应为 YYYY-MM-DD");

  const item = await prisma.productionBatch.create({
    data: {
      projectId: Number(body.projectId),
      productId: Number(body.productId),
      quantity,
      batchDate: body.batchDate,
      // 生产人默认是当前用户; 管理员可代填
      operatorId:
        g.session.role === ROLES.ADMIN && body.operatorId
          ? Number(body.operatorId)
          : g.session.id,
      note: body.note ?? "",
    },
    include: INCLUDE,
  });

  return NextResponse.json({ item });
}
