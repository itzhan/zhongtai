import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { parseEntryMoment } from "@/lib/format";
import { parseTransfer } from "@/lib/ledger";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

function toPurchaseShape(row: {
  id: number;
  projectId: number;
  amount: number;
  note: string;
  entryDate: string;
  createdById: number | null;
  creatorName: string;
  currency?: string;
  channel?: string;
  fromKind?: string;
  fromId?: number | null;
  fromName?: string;
  toKind?: string;
  toId?: number | null;
  toName?: string;
  entryAt?: Date | string | null;
  createdAt?: Date | string;
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
    entryKind: "cost" as const,
    amount: row.amount,
    note: row.note,
    entryDate: row.entryDate,
    entryAt: row.entryAt ?? null,
    createdAt: row.createdAt ?? null,
    currency: row.currency ?? "cny",
    channel: row.channel ?? "",
    fromKind: row.fromKind ?? "",
    fromId: row.fromId ?? null,
    fromName: row.fromName ?? "",
    toKind: row.toKind ?? "",
    toId: row.toId ?? null,
    toName: row.toName ?? "",
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.financeEntry.findFirst({
    where: { id, kind: "cost", deletedAt: null },
  });
  if (!existing) return notFound("成本记录不存在");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (body.projectId !== undefined) {
    const projectId = Number(body.projectId);
    if (!projectId) return badRequest("请选择归属项目");
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) return badRequest("项目不存在");
    data.projectId = projectId;
  }

  if (body.amount !== undefined || body.totalAmount !== undefined) {
    const v = Number(body.amount ?? body.totalAmount);
    if (!Number.isFinite(v) || v < 0) return badRequest("金额非法");
    data.amount = v;
  }

  const note = body.note ?? body.detail ?? body.content;
  if (note !== undefined) {
    const v = String(note).trim();
    if (!v) return badRequest("花销说明不能为空");
    data.note = v;
  }

  const entryDate = body.entryDate ?? body.purchaseDate;
  if (entryDate !== undefined) {
    const moment = parseEntryMoment(String(entryDate));
    if (!moment) return badRequest("请填写发生时间");
    data.entryDate = moment.entryDate;
    data.entryAt = moment.entryAt;
  }

  if (body.purchaserName !== undefined) {
    const purchaserName = String(body.purchaserName).trim();
    if (!purchaserName) return badRequest("采购人不能为空");
    data.creatorName = purchaserName;
  }

  if (
    body.fromKind !== undefined ||
    body.fromId !== undefined ||
    body.toKind !== undefined ||
    body.toId !== undefined ||
    body.currency !== undefined ||
    body.channel !== undefined
  ) {
    const transfer = await parseTransfer(
      {
        fromKind: body.fromKind ?? existing.fromKind,
        fromId: body.fromId ?? existing.fromId,
        toKind: body.toKind ?? existing.toKind,
        toId: body.toId ?? existing.toId,
        currency: body.currency ?? existing.currency,
        channel: body.channel ?? existing.channel,
      },
      true,
    );
    if ("error" in transfer) return badRequest(transfer.error);
    Object.assign(data, transfer);
  }

  const item = await prisma.financeEntry.update({
    where: { id },
    data,
    include: INCLUDE,
  });
  return jsonItem("financeEntry", g.session.role, toPurchaseShape(item));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.financeEntry.findFirst({
    where: { id, kind: "cost", deletedAt: null },
  });
  if (!existing) return notFound("成本记录不存在");

  await prisma.financeEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
