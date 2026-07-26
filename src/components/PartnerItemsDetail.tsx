"use client";
import { fmtMoneyShort } from "@/lib/format";

export interface DetailItem {
  id: number;
  quantity: number;
  /// 脱敏后可能是 null (例如生产看不到卖价)
  unitPrice: number | null;
  note: string;
  product: { id: number; name: string };
}

/// 台子/供货方列表里展开行显示的明细子表。
/// 不做详情页 —— 展开行更快, 而且能同时对比多个台子。
export default function PartnerItemsDetail({
  items,
  priceLabel,
  showPrice,
}: {
  items: DetailItem[];
  priceLabel: string;
  /// 当前角色能否看到单价。看不到时整列不渲染, 而不是显示一列 "-"
  showPrice: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-1">还没有货明细</p>;
  }

  const total = items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);

  return (
    <div className="rounded-lg bg-muted/30 p-3 space-y-2">
      <div className="grid gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 [grid-template-columns:1fr_80px_100px_100px_1fr]">
        <div>产品</div>
        <div className="text-right">数量</div>
        {showPrice && <div className="text-right">{priceLabel}</div>}
        {showPrice && <div className="text-right">小计</div>}
        <div>备注</div>
      </div>

      {items.map((it) => (
        <div
          key={it.id}
          className="grid gap-2 text-sm items-center [grid-template-columns:1fr_80px_100px_100px_1fr]"
        >
          <div className="truncate">{it.product.name}</div>
          <div className="text-right tabular-nums">{it.quantity}</div>
          {showPrice && (
            <div className="text-right tabular-nums">{fmtMoneyShort(it.unitPrice ?? 0)}</div>
          )}
          {showPrice && (
            <div className="text-right tabular-nums font-medium">
              {fmtMoneyShort(it.quantity * (it.unitPrice ?? 0))}
            </div>
          )}
          <div className="truncate text-xs text-muted-foreground">{it.note || "-"}</div>
        </div>
      ))}

      {showPrice && (
        <div className="flex justify-end gap-3 pt-1 border-t border-border text-sm">
          <span className="text-muted-foreground">合计</span>
          <span className="font-semibold tabular-nums">{fmtMoneyShort(total)}</span>
        </div>
      )}
    </div>
  );
}
