import { prisma } from "@/lib/db";
import {
  isOneOf,
  parseSupplierCategories,
  serializeSupplierCategories,
  splitGoodsNames,
  SUPPLIER_CATEGORY,
} from "@/lib/enums";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { SUPPLIER_INCLUDE } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const category = (sp.get("category") ?? "").trim();

  const items = await prisma.supplier.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { wechat: { contains: q } },
              { contact: { contains: q } },
              { baseUrl: { contains: q } },
              { goods: { contains: q } },
              { goodsItems: { some: { name: { contains: q } } } },
            ],
          }
        : {}),
      ...(isOneOf(SUPPLIER_CATEGORY, category) ? { category: { contains: category } } : {}),
    },
    include: SUPPLIER_INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("supplier", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    wechat: string;
    contact: string;
    baseUrl: string;
    goods: string;
    category: string | string[];
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写供应商名称");
  const categories = parseSupplierCategories(body.category);
  if (!categories.length) return badRequest("请选择业务分类");

  const goodsNames = splitGoodsNames(body.goods ?? "");
  const item = await prisma.supplier.create({
    data: {
      name,
      owner: { connect: { id: g.session.id } },
      wechat: (body.wechat ?? "").trim(),
      contact: (body.contact ?? "").trim(),
      baseUrl: (body.baseUrl ?? "").trim(),
      goods: goodsNames.join("、"),
      category: serializeSupplierCategories(categories),
      goodsItems: { create: goodsNames.map((goodsName) => ({ name: goodsName, rate: "" })) },
    },
    include: SUPPLIER_INCLUDE,
  });

  return jsonItem("supplier", g.session.role, item);
}
