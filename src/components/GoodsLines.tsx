"use client";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import LineItemsFrame, { LineItemRow } from "@/components/LineItemsFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtMoneyShort } from "@/lib/format";

export interface GoodsLine {
  /// 稳定的行 key。必须用 uuid 而非数组下标 —— 删中间行时下标做 key 会让
  /// React 复用错行, 输入框内容串位。
  key: string;
  productId: number | null;
  quantity: number;
  unitPrice: number;
  note: string;
}

export interface ProductOption {
  id: number;
  name: string;
}

const COLS = "1fr 90px 120px 1fr 36px";

export function newLine(): GoodsLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    quantity: 1,
    unitPrice: 0,
    note: "",
  };
}

/// 台子的「货需求」与供货方的「能供的货」共用这个编辑器 —— 结构相同,
/// 只有单价的语义不同 (卖价 vs 进货价), 由 priceLabel 区分。
export default function GoodsLines({
  value,
  onChange,
  products,
  priceLabel = "单价",
  qtyLabel = "数量",
  qtyHint,
}: {
  value: GoodsLine[];
  onChange: (v: GoodsLine[]) => void;
  products: ProductOption[];
  priceLabel?: string;
  qtyLabel?: string;
  qtyHint?: string;
}) {
  const total = useMemo(
    () => value.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    [value],
  );

  const patch = (i: number, p: Partial<GoodsLine>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  return (
    <div className="space-y-1.5">
      <LineItemsFrame
        cols={COLS}
        header={["产品", qtyLabel, priceLabel, "备注", ""]}
        total={fmtMoneyShort(total)}
        isEmpty={value.length === 0}
        onAdd={() => onChange([...value, newLine()])}
      >
        {value.map((l, i) => (
          <LineItemRow key={l.key} cols={COLS}>
            <Select
              value={l.productId ? String(l.productId) : ""}
              onValueChange={(v) => patch(i, { productId: Number(v) })}
            >
              <SelectTrigger className="col-span-2 md:col-span-1">
                <SelectValue placeholder="选择产品" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              inputMode="decimal"
              className="tabular-nums"
              aria-label={qtyLabel}
              value={l.quantity}
              onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="tabular-nums"
              aria-label={priceLabel}
              value={l.unitPrice}
              onChange={(e) => patch(i, { unitPrice: Number(e.target.value) })}
            />
            <Input
              placeholder="备注"
              className="col-span-2 md:col-span-1"
              value={l.note}
              onChange={(e) => patch(i, { note: e.target.value })}
            />

            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="删除该行"
              className="text-muted-foreground hover:text-destructive justify-self-end"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            >
              <Trash2 size={14} />
            </Button>
          </LineItemRow>
        ))}
      </LineItemsFrame>
      {qtyHint && <p className="text-xs text-muted-foreground">{qtyHint}</p>}
    </div>
  );
}
