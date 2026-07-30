import { prisma } from "./db";
import { ROLES } from "./rbac";

export const ALLOCATION_INCLUDE = {
  assignee: { select: { id: true, displayName: true } },
  allocator: { select: { id: true, displayName: true } },
  project: { select: { id: true, code: true, name: true } },
  items: { include: { source: { select: { id: true, name: true } }, email: { select: { id: true, address: true } }, proxy: { select: { id: true, host: true, port: true } }, card: { select: { id: true, cardNo: true } } } },
} as const;
export interface AllocationInputItem { kind: "email" | "proxy" | "card"; sourceId?: number | null; business?: string; emailId?: number | null; proxyId?: number | null; cardId?: number | null; quantity?: number; amount?: number }
export function normalizeItems(rows: AllocationInputItem[]) { return rows.map((row) => ({ kind: row.kind, sourceId: row.sourceId ? Number(row.sourceId) : null, business: (row.business ?? "").trim(), emailId: row.emailId ? Number(row.emailId) : null, proxyId: row.proxyId ? Number(row.proxyId) : null, cardId: row.cardId ? Number(row.cardId) : null, quantity: row.kind === "card" ? 0 : 1, amount: row.kind === "card" ? Math.max(0, Number(row.amount) || 0) : 0 })); }
export function supportsBusiness(usage: string, business: string) { return Boolean(business) && usage.split(",").map((value) => value.trim()).filter(Boolean).includes(business); }
export async function validateAssignee(id: number) { return prisma.user.findFirst({ where: { id, role: ROLES.PRODUCTION, active: true } }); }
