import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { DESK_INCLUDE, validateLines } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const projectId = sp.get("projectId");
  const status = sp.get("status");

  const items = await prisma.desk.findMany({
    where: {
      // 行级权限: 销售只看自己的台子; 财务/管理员看全部
      ...(g.session.role === ROLES.SALES ? { ownerId: g.session.id } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }] } : {}),
      ...(projectId && projectId !== "all" ? { projectId: Number(projectId) } : {}),
      ...(status && status !== "all" ? { status } : {}),
    },
    include: DESK_INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("desk", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    projectId: number;
    ownerId: number;
    contact: string;
    demand: string;
    status: string;
    notes: string;
    items: { productId: number; quantity: number; unitPrice: number; note?: string }[];
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写台子名称");
  if (!body.projectId) return badRequest("请选择归属项目");
  if (body.status !== undefined && !isOneOf(PARTNER_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const lines = validateLines(body.items);
  if (typeof lines === "string") return badRequest(lines);

  // 销售只能建自己的台子; 财务/管理员可以指定归属销售
  const ownerId = g.session.role === ROLES.SALES ? g.session.id : (body.ownerId ?? g.session.id);

  const item = await prisma.desk.create({
    data: {
      name,
      ownerId,
      projectId: Number(body.projectId),
      contact: body.contact ?? "",
      demand: body.demand ?? "",
      status: body.status ?? "active",
      notes: body.notes ?? "",
      items: { create: lines },
    },
    include: DESK_INCLUDE,
  });

  return jsonItem("desk", g.session.role, item);
}
