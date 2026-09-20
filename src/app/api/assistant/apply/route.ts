import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRoleFresh } from "@/lib/guard";
import {
  canUseAction,
  isAssistantAction,
  isFinanceKind,
  normalizeSupplierCategories,
  type AssistantAction,
} from "@/lib/ai-actions";
import { parseTransfer } from "@/lib/ledger";
import { COST_SOURCE, isOneOf, serializeSupplierCategories } from "@/lib/enums";
import { DESK_INCLUDE, SUPPLIER_INCLUDE } from "@/lib/partner";
import { ROLES, type Role } from "@/lib/rbac";
import { todayStr } from "@/lib/format";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    items?: Record<string, unknown>[];
  };
  if (!isAssistantAction(body.action)) return badRequest("请选择操作类型");
  const action = body.action as AssistantAction;
  if (!canUseAction(g.session.role as Role, action)) {
    return NextResponse.json({ error: "无权执行该操作" }, { status: 403 });
  }

  const rows = Array.isArray(body.items) ? body.items : [];
  if (!rows.length) return badRequest("没有可执行的记录");

  const created: unknown[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      created.push(await applyOne(action, rows[i], g.session));
    } catch (e) {
      errors.push({ index: i, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    items: created,
    errors,
    ok: created.length,
    failed: errors.length,
  });
}

async function applyOne(
  action: AssistantAction,
  raw: Record<string, unknown>,
  session: { id: number; displayName: string; role: string },
) {
  switch (action) {
    case "bookkeep": {
      if (!isFinanceKind(raw.kind)) throw new Error("方向非法");
      const projectId = Number(raw.projectId);
      if (!projectId) throw new Error("项目无效");
      const amount = Number(raw.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("金额非法");
      const entryDate = String(raw.entryDate || todayStr());
      if (!DATE_RE.test(entryDate)) throw new Error("日期格式非法");
      const note = String(raw.note ?? "").trim();
      if (!note) throw new Error("说明不能为空");
      if (!(await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }))) {
        throw new Error("项目不存在");
      }

      let costSource = "self";
      let supplierId: number | null = null;
      if (raw.kind === "cost") {
        costSource = String(raw.costSource ?? "self");
        if (!isOneOf(COST_SOURCE, costSource)) throw new Error("成本类型非法");
        if (costSource === "supplier") {
          const sid = Number(raw.supplierId);
          if (!sid) throw new Error("请选择供应商");
          const supplier = await prisma.supplier.findUnique({ where: { id: sid }, select: { id: true } });
          if (!supplier) throw new Error("供应商不存在");
          supplierId = sid;
        }
      }

      const transfer = await parseTransfer(raw, true);
      if ("error" in transfer) throw new Error(transfer.error);

      return prisma.financeEntry.create({
        data: {
          projectId,
          kind: raw.kind,
          amount,
          note,
          entryDate,
          costSource,
          supplierId,
          createdById: session.id,
          creatorName: session.displayName,
          ...transfer,
        },
        include: {
          project: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      });
    }
    case "create_project": {
      if (session.role !== ROLES.ADMIN) throw new Error("仅管理员可创建项目");
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("项目名称不能为空");
      return prisma.project.create({
        data: {
          code: `PROJECT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          status: String(raw.status || "active"),
          description: String(raw.description ?? ""),
        },
      });
    }
    case "create_desk": {
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("需求名称不能为空");
      const projectIds = Array.isArray(raw.projectIds)
        ? raw.projectIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : raw.projectId
          ? [Number(raw.projectId)]
          : [];
      if (!projectIds.length) throw new Error("请指定所属项目");
      const count = await prisma.project.count({ where: { id: { in: projectIds } } });
      if (count !== projectIds.length) throw new Error("部分项目不存在");
      return prisma.desk.create({
        data: {
          name,
          ownerId: session.id,
          ownerName: String(raw.ownerName ?? "").trim(),
          status: String(raw.status || "active"),
          projects: { create: projectIds.map((projectId) => ({ projectId })) },
        },
        include: DESK_INCLUDE,
      });
    }
    case "create_supplier": {
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("供应商名称不能为空");
      const categories = normalizeSupplierCategories(raw.category);
      if (!categories.length) throw new Error("请选择业务分类");
      return prisma.supplier.create({
        data: {
          name,
          owner: { connect: { id: session.id } },
          wechat: String(raw.wechat ?? "").trim(),
          contact: String(raw.contact ?? "").trim(),
          baseUrl: String(raw.baseUrl ?? "").trim(),
          goods: String(raw.goods ?? "").trim(),
          category: serializeSupplierCategories(categories),
        },
        include: SUPPLIER_INCLUDE,
      });
    }
  }
}
