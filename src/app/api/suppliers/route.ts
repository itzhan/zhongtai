import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { SUPPLIER_INCLUDE, validateLines } from "@/lib/partner";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const projectId = sp.get("projectId");
  const status = sp.get("status");

  const items = await prisma.supplier.findMany({
    where: {
      ...(q
        ? { OR: [{ name: { contains: q } }, { channel: { contains: q } }, { contact: { contains: q } }] }
        : {}),
      ...(projectId && projectId !== "all" ? { projectId: Number(projectId) } : {}),
      ...(status && status !== "all" ? { status } : {}),
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
    projectId: number;
    ownerId: number | null;
    contact: string;
    channel: string;
    status: string;
    notes: string;
    items: { productId: number; quantity: number; unitPrice: number; note?: string }[];
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写供货方名称");
  if (!body.projectId) return badRequest("请选择归属项目");
  if (body.status !== undefined && !isOneOf(PARTNER_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const lines = validateLines(body.items);
  if (typeof lines === "string") return badRequest(lines);

  const item = await prisma.supplier.create({
    data: {
      name,
      ownerId: body.ownerId ?? g.session.id,
      projectId: Number(body.projectId),
      contact: body.contact ?? "",
      channel: body.channel ?? "",
      status: body.status ?? "active",
      notes: body.notes ?? "",
      items: { create: lines },
    },
    include: SUPPLIER_INCLUDE,
  });

  return jsonItem("supplier", g.session.role, item);
}
