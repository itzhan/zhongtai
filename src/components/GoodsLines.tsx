"use client";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import LineItemsFrame, { LineItemRow } from "@/components/LineItemsFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface GoodsLine {
  /// 稳定的行 key。必须用 uuid 而非数组下标 —— 删中间行时下标做 key 会让
  /// React 复用错行, 输入框内容串位。
  key: string;
  productId: number | null;
  productName: string;
  apiKey: string;
  quantity: number;
  unitPrice: number;
  note: string;
}

export interface ProductOption {
  id: number;
  name: string;
}

export function newLine(): GoodsLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    productName: "",
    apiKey: "",
    quantity: 0,
    unitPrice: 0,
    note: "",
  };
}

/// 台子的「货需求」与供货方的「能供的货」共用这个编辑器 —— 结构相同,
/// 只有单价的语义不同 (卖价 vs 进货价), 由 priceLabel 区分。
export default function GoodsLines({
  value,
  onChange,
  priceLabel = "单价",
  showKey = false,
}: {
  value: GoodsLine[];
  onChange: (v: GoodsLine[]) => void;
  products?: ProductOption[];
  priceLabel?: string;
  showKey?: boolean;
}) {
  const total = useMemo(() => value.reduce((s, l) => s + (l.unitPrice || 0), 0), [value]);
  const cols = showKey ? "1fr 1fr 120px 36px" : "1fr 120px 36px";

  const patch = (i: number, p: Partial<GoodsLine>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  return (
    <div className="space-y-1.5">
      <LineItemsFrame
        cols={cols}
        header={showKey ? ["产品", "Key", priceLabel, ""] : ["产品", priceLabel, ""]}
        total={`共 ${value.length} 项`}
        isEmpty={value.length === 0}
        onAdd={() => onChange([...value, newLine()])}
      >
        {value.map((l, i) => (
          <LineItemRow key={l.key} cols={cols}>
            <Input value={l.productName} onChange={(e) => patch(i, { productName: e.target.value })} placeholder="填写产品名称" />
            {showKey && <Input value={l.apiKey} onChange={(e) => patch(i, { apiKey: e.target.value })} placeholder="填写产品 Key" className="font-mono" />}
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
    </div>
  );
}
