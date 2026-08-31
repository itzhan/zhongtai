import type { Prisma, PrismaClient } from "@prisma/client";

// 台子 (Desk) 与供货方 (Supplier) 的共用服务端逻辑。
//
// 放在 lib 而不是 route.ts 里: Next 15 的 route.ts 只允许导出 HTTP 方法
// 和少数几个配置项 (runtime / dynamic / maxDuration), 导出别的东西会让
// 构建报类型错误。

export const DESK_INCLUDE = {
  items: {
    include: { product: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  },
  owner: { select: { id: true, displayName: true } },
  projects: {
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: { projectId: "asc" },
  },
} as const;

export const SUPPLIER_INCLUDE = {
  owner: { select: { id: true, displayName: true } },
  goodsItems: { orderBy: { id: "asc" as const } },
} as const;

export const SUPPLIER_DETAIL_INCLUDE = {
  owner: { select: { id: true, displayName: true } },
  goodsItems: { orderBy: { id: "asc" as const } },
  comments: {
    include: { createdBy: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  entries: {
    where: { deletedAt: null, kind: "cost" },
    include: {
      project: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
    orderBy: [{ entryDate: "desc" as const }, { id: "desc" as const }],
  },
};

export interface RawLine {
  productId?: number;
  productName?: string;
  apiKey?: string;
  quantity?: number;
  unitPrice: number;
  note?: string;
}

export interface Line {
  productId: number;
  productName: string;
  apiKey: string;
  quantity: number;
  unitPrice: number;
  note: string;
}

/// 明细行校验 —— 台子的单价是卖价、供货方的是进价, 但校验规则相同。
/// 返回 string = 报错文案; 返回数组 = 校验通过、可直接入库的数据。
export async function resolveLines(db: PrismaClient | Prisma.TransactionClient, raw: RawLine[] | undefined, projectId?: number | null): Promise<string | Line[]> {
  const items = raw ?? [];
  const out: Line[] = [];
  for (let i = 0; i < items.length; i++) {
    const l = items[i];
    const productName = (l?.productName ?? "").trim();
    if (!productName) return `第 ${i + 1} 行未填写产品`;
    const quantity = 1;
    const unitPrice = Number(l.unitPrice);
    if (!Number.isFinite(quantity) || quantity < 0) return `第 ${i + 1} 行数量非法`;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return `第 ${i + 1} 行单价非法`;
    const existing = await db.product.findFirst({
      where: { name: productName, ...(projectId ? { projectId } : {}) },
      select: { id: true },
    });
    const productId = existing?.id ?? (await db.product.create({ data: { projectId: projectId ?? null, name: productName } })).id;
    out.push({
      productId,
      productName,
      apiKey: l.apiKey ?? "",
      quantity,
      unitPrice,
      note: l.note ?? "",
    });
  }
  return out;
}

export function parseProjectIds(raw: unknown, fallback?: number | null): number[] {
  const ids = new Set<number>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const n = Number(item);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
  }
  if (fallback && Number.isInteger(fallback) && fallback > 0) ids.add(fallback);
  return [...ids];
}

export async function replaceDeskProjects(
  db: PrismaClient | Prisma.TransactionClient,
  deskId: number,
  projectIds: number[],
) {
  await db.deskProject.deleteMany({ where: { deskId } });
  if (!projectIds.length) return;
  await db.deskProject.createMany({ data: projectIds.map((projectId) => ({ deskId, projectId })) });
}
