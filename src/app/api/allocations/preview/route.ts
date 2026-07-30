import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";
import { supportsBusiness } from "@/lib/allocation";

export const runtime = "nodejs";
type RequestRow = { kind: "email" | "proxy" | "card"; sourceId?: number | null; business?: string; quantity?: number; amount?: number };

export async function POST(req: Request) {
  const g = await requireRole(ROLES.RESOURCE);
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { allocationId?: number; rows?: RequestRow[] };
  const allocationId = Number(body.allocationId) || 0;
  const current = allocationId ? await prisma.resourceAllocationItem.findMany({ where: { allocationId } }) : [];
  const preview: Record<string, unknown>[] = [];

  for (const request of body.rows ?? []) {
    const sourceId = request.sourceId ? Number(request.sourceId) : undefined;
    const business = (request.business ?? "").trim();
    if (request.kind === "email") {
      const quantity = Math.floor(Number(request.quantity) || 0);
      if (quantity === 0) continue;
      if (quantity <= 0 || !business) return badRequest("邮箱需选择业务并填写数量");
      const emails = await prisma.emailResource.findMany({ where: { status: "available", ...(sourceId ? { sourceId } : {}) }, include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" } });
      const available = [];
      for (const email of emails) {
        if (!supportsBusiness(email.usage, business)) continue;
        const assigned = await prisma.resourceAllocationItem.findFirst({ where: { emailId: email.id, business, ...(allocationId ? { allocationId: { not: allocationId } } : {}) } });
        if (!assigned) available.push(email);
        if (available.length === quantity) break;
      }
      if (available.length < quantity) return badRequest(`可用的 ${business} 邮箱不足，当前只有 ${available.length} 个`);
      for (const email of available) preview.push({ kind: "email", sourceId: email.sourceId, business, emailId: email.id, quantity: 1, amount: 0, label: email.address, source: email.source?.name ?? "-" });
    } else if (request.kind === "proxy") {
      const quantity = Math.floor(Number(request.quantity) || 0);
      if (quantity === 0) continue;
      if (quantity <= 0) return badRequest("代理 IP 数量需大于 0");
      const proxies = await prisma.proxyResource.findMany({ where: { status: "available", ...(sourceId ? { sourceId } : {}) }, include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" }, take: quantity });
      if (proxies.length < quantity) return badRequest(`可用代理 IP 不足，当前只有 ${proxies.length} 个`);
      for (const proxy of proxies) preview.push({ kind: "proxy", sourceId: proxy.sourceId, business: "", proxyId: proxy.id, quantity: 1, amount: 0, label: `${proxy.host}:${proxy.port}`, source: proxy.source?.name ?? "-" });
    } else {
      let needed = Number(request.amount) || 0;
      if (needed === 0) continue;
      if (needed <= 0 || !business) return badRequest("卡需选择业务并填写分配金额");
      const oldByCard = new Map(current.filter((x) => x.kind === "card" && x.cardId).map((x) => [x.cardId!, x.amount]));
      const cards = await prisma.cardResource.findMany({ where: { status: { in: ["available", "used"] }, ...(sourceId ? { sourceId } : {}) }, include: { source: { select: { id: true, name: true } } }, orderBy: { id: "asc" } });
      for (const card of cards) {
        if (!supportsBusiness(card.usage, business)) continue;
        const available = card.amount + (oldByCard.get(card.id) ?? 0);
        if (available <= 0) continue;
        const amount = Math.min(available, needed);
        preview.push({ kind: "card", sourceId: card.sourceId, business, cardId: card.id, quantity: 0, amount, label: `${card.cardNo} (余额 ${available})`, source: card.source?.name ?? "-" });
        needed -= amount;
        if (needed <= 0.000001) break;
      }
      if (needed > 0.000001) return badRequest(`符合条件的卡余额不足，还差 ${needed.toFixed(2)}`);
    }
  }
  if (!preview.length) return badRequest("请填写要分配的资源");
  return NextResponse.json({ items: preview });
}
