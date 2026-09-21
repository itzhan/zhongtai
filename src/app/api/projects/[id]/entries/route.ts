import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { COST_SOURCE, FINANCE_KIND, isOneOf } from "@/lib/enums";
import { parseEntryMoment } from "@/lib/format";
import { parseDebtor, parseTransfer } from "@/lib/ledger";
import { jsonItem, maskMany } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  supplier: { select: { id: true, name: true } },
} as const;

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

  let kindWhere: Record<string, unknown> = {};
  if (kind && kind !== "all") {
    if (!isOneOf(FINANCE_KIND, kind)) return badRequest("流水类型非法");
    if (g.session.role === ROLES.SALES && kind === "cost") return badRequest("无权查看成本");
    if (g.session.role === ROLES.RESOURCE && kind !== "cost") return badRequest("无权查看该类型");
    kindWhere = { kind };
  } else if (g.session.role === ROLES.SALES) {
    kindWhere = { kind: { in: ["income", "receivable"] } };
  } else if (g.session.role === ROLES.RESOURCE) {
    kindWhere = { kind: "cost" };
  }

  const where = {
    projectId,
    deletedAt: null,
    ...kindWhere,
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

  if (!isOneOf(FINANCE_KIND, body.kind)) return badRequest("请选择收入、成本或待收款");

  if (g.session.role === ROLES.SALES && body.kind !== "income" && body.kind !== "receivable") {
    return badRequest("销售只能新增收入或待收款");
  }
  if (g.session.role === ROLES.RESOURCE && body.kind !== "cost") {
    return badRequest("资源管理员只能新增成本记录");
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return badRequest("金额非法");
  const moment = parseEntryMoment(String(body.entryDate ?? body.entryAt ?? ""));
  if (!moment) return badRequest("请填写发生时间");
  const { entryDate, entryAt } = moment;
  const note = String(body.note ?? "").trim();
  if (!note) return badRequest("请填写这笔钱是干啥的");

  let transfer: Awaited<ReturnType<typeof parseTransfer>>;
  if (body.kind === "receivable") {
    const debtor = await parseDebtor(body);
    if ("error" in debtor) return badRequest(debtor.error);
    transfer = {
      fromKind: debtor.fromKind,
      fromId: debtor.fromId,
      fromName: debtor.fromName,
      toKind: "",
      toId: null,
      toName: "",
      currency: debtor.currency,
      channel: "",
    };
  } else {
    transfer = await parseTransfer(body, true);
    if ("error" in transfer) return badRequest(transfer.error);
  }

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
      entryAt,
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
