import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, RESOURCE_KIND } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  items: { include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
  project: { select: { id: true, code: true, name: true } },
  reporter: { select: { id: true, displayName: true } },
  handledBy: { select: { id: true, displayName: true } },
  purchases: { select: { id: true, totalAmount: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const g = await requireRole(ROLES.PRODUCTION, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const projectId = sp.get("projectId");

  const items = await prisma.resourceRequest.findMany({
    where: {
      // 行级权限: 生产只看自己提的申报
      ...(g.session.role === ROLES.PRODUCTION ? { reporterId: g.session.id } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(projectId && projectId !== "all" ? { projectId: Number(projectId) } : {}),
    },
    include: INCLUDE,
    orderBy: [{ periodDate: "desc" }, { id: "desc" }],
  });

  return jsonItems("request", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    projectId: number;
    periodDate: string;
    note: string;
    items: { kind: string; sourceId: number | null; quantity: number; amount: number; note?: string }[];
  }>;

  if (!body.projectId) return badRequest("请选择归属项目");
  if (!body.periodDate || !DATE_RE.test(body.periodDate)) {
    return badRequest("消耗日期格式应为 YYYY-MM-DD");
  }

  const lines = body.items ?? [];
  if (lines.length === 0) return badRequest("请至少填写一条消耗明细");

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!isOneOf(RESOURCE_KIND, l.kind)) return badRequest(`第 ${i + 1} 行资源类型非法`);
    const qty = Number(l.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return badRequest(`第 ${i + 1} 行数量需为正整数`);
    const amt = Number(l.amount);
    if (!Number.isFinite(amt) || amt < 0) return badRequest(`第 ${i + 1} 行金额非法`);
  }

  const item = await prisma.resourceRequest.create({
    data: {
      projectId: Number(body.projectId),
      reporterId: g.session.id,
      periodDate: body.periodDate,
      note: body.note ?? "",
      items: {
        create: lines.map((l) => ({
          kind: l.kind,
          sourceId: l.sourceId ?? null,
          quantity: Number(l.quantity),
          amount: Number(l.amount) || 0,
          note: l.note ?? "",
        })),
      },
    },
    include: INCLUDE,
  });

  return jsonItem("request", g.session.role, item);
}
