import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  _count: { select: { cards: true, proxies: true, emails: true } },
} as const;

/// 生产也能看来源 (申报时要选), 但 priceInfo 与三个单价被 mask 掉。
export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.FINANCE, ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const kind = sp.get("kind");

  const items = await prisma.resourceSource.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { channel: { contains: q } }] } : {}),
      ...(kind && kind !== "all" ? { kinds: { contains: kind } } : {}),
    },
    include: INCLUDE,
    orderBy: [{ active: "desc" }, { id: "desc" }],
  });

  return jsonItems("source", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    channel: string;
    kinds: string[];
    contact: string;
    emailPrice: number;
    proxyPrice: number;
    cardPrice: number;
    priceInfo: string;
    active: boolean;
    notes: string;
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写来源名称");

  const item = await prisma.resourceSource.create({
    data: {
      name,
      channel: body.channel ?? "",
      kinds: (body.kinds ?? []).join(","),
      contact: body.contact ?? "",
      emailPrice: Number(body.emailPrice) || 0,
      proxyPrice: Number(body.proxyPrice) || 0,
      cardPrice: Number(body.cardPrice) || 0,
      priceInfo: body.priceInfo ?? "",
      active: body.active ?? true,
      notes: body.notes ?? "",
    },
    include: INCLUDE,
  });

  return jsonItem("source", g.session.role, item);
}
