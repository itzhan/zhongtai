import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole } from "@/lib/guard";
import { getAiRuntimeConfig } from "@/lib/ai-config";
import { chatCompletionJson } from "@/lib/ai-client";
import {
  buildSystemPrompt,
  canUseAction,
  isAssistantAction,
  isFinanceKind,
  matchParty,
  matchProject,
  matchSupplier,
  normalizeChannel,
  normalizeCurrency,
  normalizeEnvelope,
  normalizeStatusPartner,
  normalizeStatusProject,
  normalizeSupplierCategories,
  type AssistantAction,
} from "@/lib/ai-actions";
import { todayStr } from "@/lib/format";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const g = await requireRole(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as { message?: string; action?: string };
  const message = (body.message ?? "").trim();
  if (!message) return badRequest("请输入内容");
  if (!isAssistantAction(body.action)) return badRequest("请选择操作类型");
  const action = body.action as AssistantAction;

  if (!canUseAction(g.session.role as Role, action)) {
    return NextResponse.json({ error: "无权执行该操作" }, { status: 403 });
  }

  const cfg = await getAiRuntimeConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "请先在「设置 → AI 助手」中配置接口与模型" },
      { status: 400 },
    );
  }

  const [projects, suppliers, members, partners] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { id: "desc" },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, wechat: true, goods: true, category: true },
      orderBy: { id: "desc" },
    }),
    prisma.teamMember.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.partner.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
  ]);

  try {
    const raw = await chatCompletionJson({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      temperature: cfg.temperature,
      messages: [
        { role: "system", content: buildSystemPrompt(action, projects, suppliers, members, partners) },
        { role: "user", content: message },
      ],
    });

    const env = normalizeEnvelope(raw);
    const { items, unresolved } = normalizeByAction(
      action,
      env.items,
      projects,
      suppliers,
      members,
      partners,
      [...env.unresolved],
    );

    return NextResponse.json({
      item: { action, reply: env.reply, items, unresolved },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function normalizeByAction(
  action: AssistantAction,
  items: Record<string, unknown>[],
  projects: { id: number; code: string; name: string }[],
  suppliers: { id: number; name: string; wechat: string; goods: string; category: string }[],
  members: { id: number; name: string }[],
  partners: { id: number; name: string }[],
  unresolved: string[],
): { items: Record<string, unknown>[]; unresolved: string[] } {
  const out: Record<string, unknown>[] = [];

  for (const r of items) {
    switch (action) {
      case "bookkeep": {
        const project = matchProject(projects, r.projectId, r.projectName);
        if (!project) {
          unresolved.push(`无法匹配项目: ${String(r.projectName || r.note || r.projectId)}`);
          break;
        }
        if (!isFinanceKind(r.kind)) {
          unresolved.push(`方向非法: ${String(r.kind)}`);
          break;
        }
        const amount = Number(r.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          unresolved.push(`金额非法: ${String(r.amount)}`);
          break;
        }
        let entryDate = typeof r.entryDate === "string" ? r.entryDate : todayStr();
        if (!DATE_RE.test(entryDate)) entryDate = todayStr();

        let costSource = "self";
        let supplierId: number | null = null;
        let supplierName = "";
        if (r.kind === "cost") {
          const rawSource = String(r.costSource ?? "self").trim().toLowerCase();
          const wantsSupplier =
            rawSource === "supplier" || Boolean(r.supplierId) || Boolean(r.supplierName);
          if (wantsSupplier) {
            const supplier = matchSupplier(suppliers, r.supplierId, r.supplierName);
            if (!supplier) {
              unresolved.push(`无法匹配供货方: ${String(r.supplierName || r.supplierId)}`);
              break;
            }
            costSource = "supplier";
            supplierId = supplier.id;
            supplierName = supplier.name;
          }
        }

        const channel = normalizeChannel(r.channel);
        if (!channel) {
          unresolved.push(`未识别转账渠道: ${String(r.channel || "空")}`);
          break;
        }
        const defaultFromKind = r.kind === "income" ? "partner" : "member";
        const defaultToKind = r.kind === "income" ? "member" : "partner";
        const from = matchParty(members, partners, r.fromKind ?? defaultFromKind, r.fromId, r.fromName);
        const to = matchParty(members, partners, r.toKind ?? defaultToKind, r.toId, r.toName);
        if (!from) {
          unresolved.push(`无法匹配转出人: ${String(r.fromName || r.fromId || "")}`);
          break;
        }
        if (!to) {
          unresolved.push(`无法匹配转入人: ${String(r.toName || r.toId || "")}`);
          break;
        }

        out.push({
          projectId: project.id,
          projectName: project.name,
          kind: r.kind,
          amount,
          currency: normalizeCurrency(r.currency),
          channel,
          fromKind: from.kind,
          fromId: from.id,
          fromName: from.name,
          toKind: to.kind,
          toId: to.id,
          toName: to.name,
          entryDate,
          note: String(r.note ?? "").trim() || (r.kind === "cost" ? "成本" : "收入"),
          costSource,
          supplierId,
          supplierName,
        });
        break;
      }
      case "create_project": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push("项目名称为空");
          break;
        }
        out.push({
          name,
          status: normalizeStatusProject(r.status),
          description: String(r.description ?? "").trim(),
        });
        break;
      }
      case "create_desk": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push("需求名称为空");
          break;
        }
        const names = Array.isArray(r.projectNames)
          ? r.projectNames.map(String)
          : typeof r.projectName === "string"
            ? r.projectName.split(/[,，、/]/)
            : [];
        const ids = Array.isArray(r.projectIds) ? r.projectIds : r.projectId != null ? [r.projectId] : [];
        const matched = new Map<number, string>();
        for (const rawId of ids) {
          const project = matchProject(projects, rawId);
          if (project) matched.set(project.id, project.name);
        }
        for (const rawName of names) {
          const project = matchProject(projects, null, rawName);
          if (project) matched.set(project.id, project.name);
        }
        if (!matched.size) {
          unresolved.push(`无法匹配项目: ${String(r.projectName || r.projectNames || r.projectId)}`);
          break;
        }
        out.push({
          name,
          ownerName: String(r.ownerName ?? r.owner ?? "").trim(),
          projectIds: [...matched.keys()],
          projectNames: [...matched.values()],
          status: normalizeStatusPartner(r.status),
        });
        break;
      }
      case "create_supplier": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push("供应商名称为空");
          break;
        }
        const category = normalizeSupplierCategories(r.category ?? r.kind ?? r.business);
        if (!category.length) {
          unresolved.push(`${name} 未识别业务分类（GPT / Claude / AWS / 卡网）`);
          break;
        }
        out.push({
          name,
          category,
          wechat: String(r.wechat ?? "").trim(),
          contact: String(r.contact ?? r.telegram ?? r.tg ?? "").trim(),
          baseUrl: String(r.baseUrl ?? r.website ?? r.url ?? "").trim(),
          goods: String(r.goods ?? "").trim(),
        });
        break;
      }
    }
  }

  return { items: out, unresolved };
}
