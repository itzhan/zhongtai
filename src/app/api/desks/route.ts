import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { DESK_API_KIND, isOneOf, PARTNER_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { DESK_INCLUDE, parseProjectIds, resolveLines } from "@/lib/partner";
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
      ...(g.session.role === ROLES.SALES ? { ownerId: g.session.id } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }] } : {}),
      ...(projectId && projectId !== "all" ? { projects: { some: { projectId: Number(projectId) } } } : {}),
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
    projectIds: number[];
    ownerId: number;
    ownerName: string;
    contact: string;
    demand: string;
    status: string;
    notes: string;
    baseUrl: string;
    apiKind: string;
    apiToken: string;
    items: { productName: string; unitPrice: number; note?: string }[];
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写需求名称");
  if (body.status !== undefined && !isOneOf(PARTNER_STATUS, body.status)) {
    return badRequest("状态非法");
  }
  if (body.apiKind !== undefined && !isOneOf(DESK_API_KIND, body.apiKind)) {
    return badRequest("API 类型非法");
  }

  const projectIds = parseProjectIds(body.projectIds, body.projectId ?? null);
  if (projectIds.length) {
    const count = await prisma.project.count({ where: { id: { in: projectIds } } });
    if (count !== projectIds.length) return badRequest("部分项目不存在");
  }

  const lines = await resolveLines(prisma, body.items, projectIds[0] ?? null);
  if (typeof lines === "string") return badRequest(lines);
  const deskLines = lines.map(({ apiKey: _apiKey, ...line }) => line);

  const item = await prisma.desk.create({
    data: {
      name,
      ownerId: g.session.id,
      ownerName: (body.ownerName ?? "").trim(),
      contact: body.contact ?? "",
      baseUrl: body.baseUrl ?? "",
      apiKind: body.apiKind ?? "none",
      apiToken: body.apiToken ?? "",
      demand: body.demand ?? "",
      status: body.status ?? "active",
      notes: body.notes ?? "",
      items: { create: deskLines },
      projects: { create: projectIds.map((projectId) => ({ projectId })) },
    },
    include: DESK_INCLUDE,
  });

  return jsonItem("desk", g.session.role, item);
}
