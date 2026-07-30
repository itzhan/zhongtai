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
  project: { select: { id: true, code: true, name: true } },
} as const;

export const SUPPLIER_INCLUDE = DESK_INCLUDE;

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
export async function resolveLines(db: PrismaClient | Prisma.TransactionClient, raw: RawLine[] | undefined, projectId: number): Promise<string | Line[]> {
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
    out.push({
      productId: (await db.product.findFirst({ where: { projectId, name: productName }, select: { id: true } }))?.id ?? (await db.product.create({ data: { projectId, name: productName } })).id,
      productName,
      apiKey: l.apiKey ?? "",
      quantity,
      unitPrice,
      note: l.note ?? "",
    });
  }
  return out;
}
