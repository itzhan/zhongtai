import { NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { badRequest, requireAdmin, requireAdminFresh } from "@/lib/guard";

export const runtime = "nodejs";

const ENTITIES = {
  user: { table: "User", label: "用户", name: '"displayName"' },
  project: { table: "Project", label: "项目", name: '"name"' },
  product: { table: "Product", label: "产品", name: '"name"' },
  desk: { table: "Desk", label: "台子", name: '"name"' },
  supplier: { table: "Supplier", label: "供货方", name: '"name"' },
  source: { table: "ResourceSource", label: "资源供应商", name: '"name"' },
  card: { table: "CardResource", label: "卡", name: '"cardNo"' },
  proxy: { table: "ProxyResource", label: "代理 IP", name: '"host" || \':\' || "port"' },
  email: { table: "EmailResource", label: "邮箱", name: '"address"' },
  business: { table: "ResourceBusiness", label: "业务分类", name: '"name"' },
  allocation: { table: "ResourceAllocation", label: "分配记录", name: '\'分配记录 #\' || "id"' },
  request: { table: "ResourceRequest", label: "资源申报", name: '\'资源申报 #\' || "id"' },
  purchase: { table: "Purchase", label: "采购记录", name: '"content"' },
  batch: { table: "ProductionBatch", label: "产出批次", name: '\'产出批次 #\' || "id"' },
} as const;
type Entity = keyof typeof ENTITIES;

export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.res;
  const groups = await Promise.all(Object.entries(ENTITIES).map(async ([entity, config]) => {
    const rows = await rawPrisma.$queryRawUnsafe<{ id: number; name: string; deletedAt: string }[]>(`SELECT "id", ${config.name} AS "name", "deletedAt" FROM "${config.table}" WHERE "deletedAt" IS NOT NULL ORDER BY "deletedAt" DESC`);
    return rows.map((row) => ({ ...row, entity, entityLabel: config.label }));
  }));
  const items = groups.flat().sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { entity?: Entity; id?: number };
  const config = body.entity ? ENTITIES[body.entity] : undefined;
  const id = Number(body.id);
  if (!config || !Number.isInteger(id) || id <= 0) return badRequest("恢复参数非法");

  if (body.entity === "allocation") {
    try {
      await rawPrisma.$transaction(async (tx) => {
        const allocation = await tx.resourceAllocation.findUnique({ where: { id }, include: { items: true } });
        if (!allocation?.deletedAt) throw new Error("记录不在回收站中");
        for (const row of allocation.items.filter((item) => item.kind === "card" && item.cardId)) {
          const card = await tx.cardResource.findUnique({ where: { id: row.cardId! } });
          if (!card || card.deletedAt || card.amount < row.amount) throw new Error("关联卡不存在或余额不足，无法恢复分配记录");
          await tx.cardResource.update({ where: { id: card.id }, data: { amount: { decrement: row.amount }, ...(card.amount === row.amount ? { status: "used", usedAt: new Date() } : {}) } });
        }
        await tx.resourceAllocation.update({ where: { id }, data: { deletedAt: null } });
      });
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "恢复失败");
    }
  } else {
    await rawPrisma.$executeRawUnsafe(`UPDATE "${config.table}" SET "deletedAt" = NULL${body.entity === "user" ? ', "active" = true' : ""} WHERE "id" = ? AND "deletedAt" IS NOT NULL`, id);
  }
  return NextResponse.json({ ok: true });
}
