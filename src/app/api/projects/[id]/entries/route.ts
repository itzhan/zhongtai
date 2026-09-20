import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { COST_SOURCE, FINANCE_KIND, isOneOf } from "@/lib/enums";
import { parseTransfer } from "@/lib/ledger";
import { jsonItem, maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  supplier: { select: { id: true, name: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZES = new Set([10, 30, 50, 100]);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("项目不存在");

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const creator = (sp.get("creator") ?? "").trim();
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const rawSize = Number(sp.get("pageSize") ?? 10);
  const pageSize = PAGE_SIZES.has(rawSize) ? rawSize : 10;

  let kindFilter: string | undefined;
  if (kind && kind !== "all") {
    if (!isOneOf(FINANCE_KIND, kind)) return badRequest("流水类型非法");
    kindFilter = kind;
  } else if (g.session.role === ROLES.SALES) {
    kindFilter = "income";
  } else if (g.session.role === ROLES.RESOURCE) {
    kindFilter = "cost";
  }

  const where = {
    projectId,
    deletedAt: null,
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(creator && creator !== "all" ? { creatorName: creator } : {}),
    ...(from || to
      ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.financeEntry.count({ where }),
    prisma.financeEntry.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items: maskMany("financeEntry", g.session.role, items),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const projectId = parseId((await ctx.params).id);
  if (!projectId) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return notFound("项目不存在");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (!isOneOf(FINANCE_KIND, body.kind)) return badRequest("请选择收入或成本");

  if (g.session.role === ROLES.SALES && body.kind !== "income") {
    return badRequest("销售只能新增收入记录");
  }
  if (g.session.role === ROLES.RESOURCE && body.kind !== "cost") {
    return badRequest("资源管理员只能新增成本记录");
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return badRequest("金额非法");
  const entryDate = String(body.entryDate ?? "");
  if (!DATE_RE.test(entryDate)) {
    return badRequest("日期格式应为 YYYY-MM-DD");
  }
  const note = String(body.note ?? "").trim();
  if (!note) return badRequest("请填写这笔钱是干啥的");

  const transfer = await parseTransfer(body, true);
  if ("error" in transfer) return badRequest(transfer.error);

  let costSource = "self";
  let supplierId: number | null = null;
  if (body.kind === "cost") {
    costSource = String(body.costSource ?? "self");
    if (!isOneOf(COST_SOURCE, costSource)) return badRequest("成本类型非法");
    if (costSource === "supplier") {
      const sid = Number(body.supplierId);
      if (!sid) return badRequest("请选择供应商");
      const supplier = await prisma.supplier.findUnique({ where: { id: sid }, select: { id: true } });
      if (!supplier) return badRequest("供应商不存在");
      supplierId = sid;
    }
  }

  const item = await prisma.financeEntry.create({
    data: {
      projectId,
      kind: body.kind,
      amount,
      note,
      entryDate,
      costSource,
      supplierId,
      createdById: g.session.id,
      creatorName: g.session.displayName,
      ...transfer,
    },
    include: INCLUDE,
  });

  return jsonItem("financeEntry", g.session.role, item);
}
