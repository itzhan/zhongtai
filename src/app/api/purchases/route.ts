import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PURCHASE_KIND } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  purchaser: { select: { id: true, displayName: true } },
  source: { select: { id: true, name: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const from = sp.get("from");
  const to = sp.get("to");

  const items = await prisma.purchase.findMany({
    where: {
      ...(kind && kind !== "all" ? { kind } : {}),
      ...(from || to
        ? { purchaseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
  });

  return jsonItems("purchase", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    kind: string;
    content: string;
    detail: string;
    totalAmount: number;
    purchaseDate: string;
    sourceId: number | null;
    purchaserId: number;
    purchaserName: string;
  }>;

  if (!isOneOf(PURCHASE_KIND, body.kind)) return badRequest("采购类型非法");
  const content = (body.content ?? "").trim();
  if (!content) return badRequest("请填写采购内容");
  if (!body.purchaseDate || !DATE_RE.test(body.purchaseDate)) {
    return badRequest("采购日期格式应为 YYYY-MM-DD");
  }
  const totalAmount = Number(body.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return badRequest("总金额非法");
  const purchaserName = (body.purchaserName ?? "").trim();
  if (!purchaserName) return badRequest("请填写采购人");

  const item = await prisma.purchase.create({
    data: {
      projectId: null,
      kind: body.kind,
      content,
      detail: body.detail ?? "",
      quantity: 0,
      totalAmount,
      purchaseDate: body.purchaseDate,
      sourceId: body.sourceId ?? null,
      purchaserId: g.session.id,
      purchaserName,
      notes: "",
    },
    include: INCLUDE,
  });

  return jsonItem("purchase", g.session.role, item);
}
