import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 采购/成本记录页 —— 数据源已统一为 FinanceEntry(kind=cost)。
/// 响应字段尽量贴近原 Purchase 列表形状, 减少前端破坏面:
///   purchaseDate ← entryDate
///   totalAmount  ← amount
///   content/detail ← note
///   purchaserName ← creatorName

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toPurchaseShape(row: {
  id: number;
  projectId: number;
  amount: number;
  note: string;
  entryDate: string;
  createdById: number | null;
  creatorName: string;
  project: { id: number; code: string; name: string } | null;
  createdBy: { id: number; displayName: string } | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    requestId: null as number | null,
    kind: "other" as const,
    purchaserId: row.createdById ?? 0,
    purchaserName: row.creatorName || row.createdBy?.displayName || "",
    sourceId: null as number | null,
    content: row.note || "成本记录",
    detail: row.note,
    quantity: 0,
    totalAmount: row.amount,
    purchaseDate: row.entryDate,
    notes: "",
    project: row.project,
    purchaser: row.createdBy ?? { id: 0, displayName: row.creatorName || "-" },
    source: null as { id: number; name: string } | null,
    /// 原生流水字段, 详情页/新 UI 可直接用
    entryKind: "cost" as const,
    amount: row.amount,
    note: row.note,
    entryDate: row.entryDate,
  };
}

export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const projectId = sp.get("projectId");
  const q = (sp.get("q") ?? "").trim();

  const items = await prisma.financeEntry.findMany({
    where: {
      kind: "cost",
      deletedAt: null,
      ...(projectId && projectId !== "all" ? { projectId: Number(projectId) } : {}),
      ...(q ? { note: { contains: q } } : {}),
      ...(from || to
        ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ entryDate: "desc" }, { id: "desc" }],
  });

  // 金额脱敏仍走 financeEntry 规则; 再映射形状
  const masked = items.map((row) => {
    const shaped = toPurchaseShape(row);
    if (g.session.role === ROLES.PRODUCTION) {
      // 生产进不来此路由, 保险
      shaped.totalAmount = null as unknown as number;
      shaped.amount = null as unknown as number;
      shaped.detail = null as unknown as string;
    }
    return shaped;
  });

  // 用 financeEntry 实体脱敏 amount 再回写 totalAmount
  const withMask = masked.map((m) => {
    const amountVisible =
      g.session.role === ROLES.ADMIN ||
      g.session.role === ROLES.FINANCE ||
      g.session.role === ROLES.RESOURCE ||
      g.session.role === ROLES.SALES;
    if (!amountVisible) {
      return { ...m, totalAmount: null, amount: null, detail: null };
    }
    return m;
  });

  return NextResponse.json({ items: withMask });
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    projectId: number;
    content: string;
    detail: string;
    note: string;
    totalAmount: number;
    amount: number;
    purchaseDate: string;
    entryDate: string;
    purchaserName: string;
  }>;

  const projectId = Number(body.projectId);
  if (!projectId) return badRequest("请选择归属项目");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return badRequest("项目不存在");

  const amount = Number(body.amount ?? body.totalAmount);
  if (!Number.isFinite(amount) || amount < 0) return badRequest("金额非法");

  const entryDate = body.entryDate || body.purchaseDate;
  if (!entryDate || !DATE_RE.test(entryDate)) {
    return badRequest("日期格式应为 YYYY-MM-DD");
  }

  const note = (body.note ?? body.detail ?? body.content ?? "").trim();
  if (!note) return badRequest("请填写花销说明");

  const creatorName =
    (body.purchaserName ?? "").trim() || g.session.displayName;

  const item = await prisma.financeEntry.create({
    data: {
      projectId,
      kind: "cost",
      amount,
      note,
      entryDate,
      createdById: g.session.id,
      creatorName,
    },
    include: INCLUDE,
  });

  return jsonItem("financeEntry", g.session.role, toPurchaseShape(item));
}
