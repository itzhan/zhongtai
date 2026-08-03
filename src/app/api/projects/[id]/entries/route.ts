import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { FINANCE_KIND, isOneOf } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/// 读: 销售看收入、资源看成本、财务/管理员全看 (admin 经 hasRole 隐式全通)
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("项目不存在");

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const from = sp.get("from");
  const to = sp.get("to");

  // 角色默认过滤方向
  let kindFilter: string | undefined;
  if (kind && kind !== "all") {
    if (!isOneOf(FINANCE_KIND, kind)) return badRequest("流水类型非法");
    kindFilter = kind;
  } else if (g.session.role === ROLES.SALES) {
    kindFilter = "income";
  } else if (g.session.role === ROLES.RESOURCE) {
    kindFilter = "cost";
  }

  const items = await prisma.financeEntry.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(from || to
        ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ entryDate: "desc" }, { id: "desc" }],
  });

  return jsonItems("financeEntry", g.session.role, items);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("项目不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    kind: string;
    amount: number;
    note: string;
    entryDate: string;
  }>;

  if (!isOneOf(FINANCE_KIND, body.kind)) return badRequest("请选择收入或成本");

  // 销售只能录收入, 资源只能录成本
  if (g.session.role === ROLES.SALES && body.kind !== "income") {
    return badRequest("销售只能新增收入记录");
  }
  if (g.session.role === ROLES.RESOURCE && body.kind !== "cost") {
    return badRequest("资源管理员只能新增成本记录");
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return badRequest("金额非法");
  if (!body.entryDate || !DATE_RE.test(body.entryDate)) {
    return badRequest("日期格式应为 YYYY-MM-DD");
  }

  const item = await prisma.financeEntry.create({
    data: {
      projectId,
      kind: body.kind,
      amount,
      note: body.note ?? "",
      entryDate: body.entryDate,
      createdById: g.session.id,
      creatorName: g.session.displayName,
    },
    include: INCLUDE,
  });

  return jsonItem("financeEntry", g.session.role, item);
}
