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
  matchProject,
  matchSource,
  normalizeCardStatus,
  normalizeEnvelope,
  normalizeIpType,
  normalizeProtocol,
  normalizeResourceStatus,
  normalizeStatusPartner,
  normalizeStatusProject,
  parseKinds,
  truthy,
  type AssistantAction,
} from "@/lib/ai-actions";
import { todayStr } from "@/lib/format";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const g = await requireRole(ROLES.SALES, ROLES.RESOURCE, ROLES.FINANCE);
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

  const [projects, sources] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { id: "desc" },
    }),
    prisma.resourceSource.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    }),
  ]);

  try {
    const raw = await chatCompletionJson({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      temperature: cfg.temperature,
      messages: [
        { role: "system", content: buildSystemPrompt(action, projects, sources) },
        { role: "user", content: message },
      ],
    });

    const env = normalizeEnvelope(raw);
    const { items, unresolved } = normalizeByAction(
      action,
      env.items,
      projects,
      sources,
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
  sources: { id: number; name: string }[],
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
        out.push({
          projectId: project.id,
          projectName: project.name,
          kind: r.kind,
          amount,
          entryDate,
          note: String(r.note ?? "").trim() || (r.kind === "cost" ? "成本" : "收入"),
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
          ownerName: String(r.ownerName ?? "").trim(),
          status: normalizeStatusProject(r.status),
          description: String(r.description ?? "").trim(),
          enableDemands: truthy(r.enableDemands),
          enableBatches: truthy(r.enableBatches),
        });
        break;
      }
      case "create_product": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push("产品名称为空");
          break;
        }
        const project = matchProject(projects, r.projectId, r.projectName);
        out.push({
          name,
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          status: String(r.status ?? "").trim(),
          capacity: String(r.capacity ?? "").trim(),
          notes: String(r.notes ?? "").trim(),
        });
        break;
      }
      case "create_desk":
      case "create_supplier": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push(action === "create_desk" ? "台子名称为空" : "供货方名称为空");
          break;
        }
        const project = matchProject(projects, r.projectId, r.projectName);
        if (!project) {
          unresolved.push(`无法匹配项目: ${String(r.projectName || r.projectId)}`);
          break;
        }
        const rawItems = Array.isArray(r.items) ? r.items : [];
        const lines = rawItems
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((it) => ({
            productName: String(it.productName ?? "").trim(),
            unitPrice: Number(it.unitPrice) || 0,
            apiKey: String(it.apiKey ?? "").trim(),
            note: String(it.note ?? "").trim(),
          }))
          .filter((it) => it.productName);

        const base: Record<string, unknown> = {
          name,
          projectId: project.id,
          projectName: project.name,
          baseUrl: String(r.baseUrl ?? "").trim(),
          status: normalizeStatusPartner(r.status),
          notes: String(r.notes ?? "").trim(),
          items: lines,
        };
        if (action === "create_desk") base.demand = String(r.demand ?? "").trim();
        else base.channel = String(r.channel ?? "").trim();
        out.push(base);
        break;
      }
      case "create_source": {
        const name = String(r.name ?? "").trim();
        if (!name) {
          unresolved.push("来源名称为空");
          break;
        }
        out.push({
          name,
          channel: String(r.channel ?? "").trim(),
          kinds: parseKinds(r.kinds),
          contact: String(r.contact ?? "").trim(),
          emailPrice: Number(r.emailPrice) || 0,
          proxyPrice: Number(r.proxyPrice) || 0,
          cardPrice: Number(r.cardPrice) || 0,
          priceInfo: String(r.priceInfo ?? "").trim(),
          notes: String(r.notes ?? "").trim(),
          active: r.active === undefined ? true : truthy(r.active),
        });
        break;
      }
      case "create_card": {
        const cardNo = String(r.cardNo ?? "").trim();
        if (!cardNo) {
          unresolved.push("卡号为空");
          break;
        }
        const project = matchProject(projects, r.projectId, r.projectName);
        const source = matchSource(sources, r.sourceId, r.sourceName);
        out.push({
          cardNo,
          cvv: String(r.cvv ?? "").trim(),
          expiry: String(r.expiry ?? "").trim(),
          holder: String(r.holder ?? "").trim(),
          amount: Number(r.amount) || 0,
          usage: String(r.usage ?? "").trim(),
          status: normalizeCardStatus(r.status),
          sourceId: source?.id ?? null,
          sourceName: source?.name ?? "",
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          notes: String(r.notes ?? "").trim(),
        });
        break;
      }
      case "create_proxy": {
        const host = String(r.host ?? "").trim();
        const port = Number(r.port);
        if (!host) {
          unresolved.push("代理地址为空");
          break;
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          unresolved.push(`端口非法: ${String(r.port)}`);
          break;
        }
        const project = matchProject(projects, r.projectId, r.projectName);
        const source = matchSource(sources, r.sourceId, r.sourceName);
        const ipType = normalizeIpType(r.ipType);
        out.push({
          protocol: normalizeProtocol(r.protocol),
          ipType,
          host,
          port,
          username: String(r.username ?? "").trim(),
          password: String(r.password ?? "").trim(),
          region: String(r.region ?? "").trim(),
          rotateUrl: ipType === "dynamic" ? String(r.rotateUrl ?? "").trim() : "",
          status: normalizeResourceStatus(r.status),
          sourceId: source?.id ?? null,
          sourceName: source?.name ?? "",
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          notes: String(r.notes ?? "").trim(),
        });
        break;
      }
      case "create_email": {
        const address = String(r.address ?? "").trim();
        if (!address) {
          unresolved.push("邮箱地址为空");
          break;
        }
        const project = matchProject(projects, r.projectId, r.projectName);
        const source = matchSource(sources, r.sourceId, r.sourceName);
        out.push({
          address,
          password: String(r.password ?? "").trim(),
          providerKey: String(r.providerKey ?? "mock").trim() || "mock",
          usage: String(r.usage ?? "").trim(),
          status: normalizeResourceStatus(r.status),
          sourceId: source?.id ?? null,
          sourceName: source?.name ?? "",
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          notes: String(r.notes ?? "").trim(),
        });
        break;
      }
    }
  }

  return { items: out, unresolved };
}
