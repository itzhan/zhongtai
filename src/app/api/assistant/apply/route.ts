import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRoleFresh } from "@/lib/guard";
import {
  canUseAction,
  isAssistantAction,
  isFinanceKind,
  type AssistantAction,
} from "@/lib/ai-actions";
import { DESK_INCLUDE, resolveLines, SUPPLIER_INCLUDE } from "@/lib/partner";
import { ROLES, type Role } from "@/lib/rbac";
import { todayStr } from "@/lib/format";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
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
      if (session.role === ROLES.SALES && raw.kind !== "income") throw new Error("销售只能记收入");
      if (session.role === ROLES.RESOURCE && raw.kind !== "cost") {
        throw new Error("资源管理员只能记成本");
      }
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
      return prisma.financeEntry.create({
        data: {
          projectId,
          kind: raw.kind,
          amount,
          note,
          entryDate,
          createdById: session.id,
          creatorName: session.displayName,
        },
        include: { project: { select: { id: true, code: true, name: true } } },
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
          ownerName: String(raw.ownerName ?? "").trim(),
          description: String(raw.description ?? ""),
          enableDemands: Boolean(raw.enableDemands),
          enableBatches: Boolean(raw.enableBatches),
        },
      });
    }
    case "create_product": {
      if (session.role !== ROLES.ADMIN) throw new Error("仅管理员可创建产品");
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("产品名称不能为空");
      let projectId: number | null = raw.projectId == null ? null : Number(raw.projectId);
      if (
        projectId &&
        !(await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }))
      ) {
        projectId = null;
      }
      return prisma.product.create({
        data: {
          name,
          status: String(raw.status ?? "").trim() || null,
          capacity: String(raw.capacity ?? "").trim() || null,
          projectId,
          notes: String(raw.notes ?? ""),
        },
        include: { project: { select: { id: true, code: true, name: true } } },
      });
    }
    case "create_desk": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.SALES) {
        throw new Error("无权创建台子");
      }
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("台子名称不能为空");
      const projectId = Number(raw.projectId);
      if (!projectId) throw new Error("请指定项目");
      if (!(await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }))) {
        throw new Error("项目不存在");
      }
      const rawLines = Array.isArray(raw.items)
        ? (raw.items as { productName?: string; unitPrice?: number; note?: string }[])
        : [];
      const lines = await resolveLines(
        prisma,
        rawLines.map((l) => ({
          productName: l.productName,
          unitPrice: Number(l.unitPrice) || 0,
          note: l.note,
        })),
        projectId,
      );
      if (typeof lines === "string") throw new Error(lines);
      return prisma.desk.create({
        data: {
          name,
          ownerId: session.id,
          projectId,
          baseUrl: String(raw.baseUrl ?? ""),
          demand: String(raw.demand ?? ""),
          status: String(raw.status || "active"),
          notes: String(raw.notes ?? ""),
          items: { create: lines.map(({ apiKey: _a, ...line }) => line) },
        },
        include: DESK_INCLUDE,
      });
    }
    case "create_supplier": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.RESOURCE) {
        throw new Error("无权创建供货方");
      }
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("供货方名称不能为空");
      const projectId = Number(raw.projectId);
      if (!projectId) throw new Error("请指定项目");
      if (!(await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }))) {
        throw new Error("项目不存在");
      }
      const rawLines = Array.isArray(raw.items)
        ? (raw.items as {
            productName?: string;
            unitPrice?: number;
            apiKey?: string;
            note?: string;
          }[])
        : [];
      const lines = await resolveLines(
        prisma,
        rawLines.map((l) => ({
          productName: l.productName,
          unitPrice: Number(l.unitPrice) || 0,
          apiKey: l.apiKey,
          note: l.note,
        })),
        projectId,
      );
      if (typeof lines === "string") throw new Error(lines);
      return prisma.supplier.create({
        data: {
          name,
          ownerId: session.id,
          projectId,
          baseUrl: String(raw.baseUrl ?? ""),
          channel: String(raw.channel ?? ""),
          status: String(raw.status || "active"),
          notes: String(raw.notes ?? ""),
          items: { create: lines },
        },
        include: SUPPLIER_INCLUDE,
      });
    }
    case "create_source": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.RESOURCE) {
        throw new Error("无权创建资源来源");
      }
      const name = String(raw.name ?? "").trim();
      if (!name) throw new Error("来源名称不能为空");
      return prisma.resourceSource.create({
        data: {
          name,
          channel: String(raw.channel ?? ""),
          kinds: String(raw.kinds ?? ""),
          contact: String(raw.contact ?? ""),
          emailPrice: Number(raw.emailPrice) || 0,
          proxyPrice: Number(raw.proxyPrice) || 0,
          cardPrice: Number(raw.cardPrice) || 0,
          priceInfo: String(raw.priceInfo ?? ""),
          active: raw.active === undefined ? true : Boolean(raw.active),
          notes: String(raw.notes ?? ""),
        },
      });
    }
    case "create_card": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.RESOURCE) {
        throw new Error("无权创建卡资源");
      }
      const cardNo = String(raw.cardNo ?? "").trim();
      if (!cardNo) throw new Error("卡号不能为空");
      return prisma.cardResource.create({
        data: {
          cardNo,
          cvv: String(raw.cvv ?? ""),
          expiry: String(raw.expiry ?? ""),
          holder: String(raw.holder ?? ""),
          amount: Number(raw.amount) || 0,
          usage: String(raw.usage ?? ""),
          status: String(raw.status || "available"),
          sourceId: raw.sourceId == null ? null : Number(raw.sourceId),
          projectId: raw.projectId == null ? null : Number(raw.projectId),
          notes: String(raw.notes ?? ""),
        },
      });
    }
    case "create_proxy": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.RESOURCE) {
        throw new Error("无权创建代理");
      }
      const host = String(raw.host ?? "").trim();
      const port = Number(raw.port);
      if (!host) throw new Error("地址不能为空");
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("端口非法");
      const ipType = String(raw.ipType || "static");
      return prisma.proxyResource.create({
        data: {
          protocol: String(raw.protocol || "socks"),
          ipType,
          host,
          port,
          username: String(raw.username ?? ""),
          password: String(raw.password ?? ""),
          region: String(raw.region ?? ""),
          rotateUrl: ipType === "dynamic" ? String(raw.rotateUrl ?? "") : "",
          status: String(raw.status || "available"),
          sourceId: raw.sourceId == null ? null : Number(raw.sourceId),
          projectId: raw.projectId == null ? null : Number(raw.projectId),
          notes: String(raw.notes ?? ""),
        },
      });
    }
    case "create_email": {
      if (session.role !== ROLES.ADMIN && session.role !== ROLES.RESOURCE) {
        throw new Error("无权创建邮箱");
      }
      const address = String(raw.address ?? "").trim();
      if (!address) throw new Error("邮箱不能为空");
      const exists = await prisma.emailResource.findUnique({ where: { address } });
      if (exists) throw new Error(`邮箱已存在: ${address}`);
      return prisma.emailResource.create({
        data: {
          address,
          password: String(raw.password ?? ""),
          providerKey: String(raw.providerKey || "mock"),
          usage: String(raw.usage ?? ""),
          status: String(raw.status || "available"),
          sourceId: raw.sourceId == null ? null : Number(raw.sourceId),
          projectId: raw.projectId == null ? null : Number(raw.projectId),
          notes: String(raw.notes ?? ""),
        },
      });
    }
  }
}
