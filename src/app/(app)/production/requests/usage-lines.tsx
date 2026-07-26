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
import type { SourceOption } from "@/hooks/use-options";
import { RESOURCE_KIND, RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";

export interface UsageLine {
  /// 稳定行 key, 不能用数组下标 —— 删中间行会串位
  key: string;
  kind: ResourceKind;
  sourceId: number | null;
  quantity: number;
  /// 单价只在前端用于算小计, 提交时换算成整行 amount
  unitPrice: number;
}

const COLS = "110px 1fr 90px 110px 100px 36px";
const NONE = "none";

export function newUsageLine(): UsageLine {
  return { key: crypto.randomUUID(), kind: "email", sourceId: null, quantity: 1, unitPrice: 0 };
}

/// 来源上按类型配了参考单价, 选完来源自动带出来当默认值 (可覆盖)。
function priceOf(source: SourceOption | undefined, kind: ResourceKind): number {
  if (!source) return 0;
  const map: Record<ResourceKind, number | null> = {
    email: source.emailPrice,
    proxy: source.proxyPrice,
    card: source.cardPrice,
  };
  return map[kind] ?? 0;
}

export default function UsageLines({
  value,
  onChange,
  sources,
}: {
  value: UsageLine[];
  onChange: (v: UsageLine[]) => void;
  sources: SourceOption[];
}) {
  const total = useMemo(
    () => value.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    [value],
  );

  const patch = (i: number, p: Partial<UsageLine>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  return (
    <LineItemsFrame
      cols={COLS}
      header={["资源类型", "来源", "数量", "单价", "小计", ""]}
      total={fmtMoneyShort(total)}
      totalLabel="消耗金额"
      isEmpty={value.length === 0}
      onAdd={() => onChange([...value, newUsageLine()])}
    >
      {value.map((l, i) => {
        const source = sources.find((s) => s.id === l.sourceId);
        return (
          <LineItemRow key={l.key} cols={COLS}>
            <Select
              value={l.kind}
              onValueChange={(v) => {
                const kind = v as ResourceKind;
                patch(i, { kind, unitPrice: priceOf(source, kind) || l.unitPrice });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_KIND.map((k) => (
                  <SelectItem key={k} value={k}>
                    {RESOURCE_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={l.sourceId ? String(l.sourceId) : NONE}
              onValueChange={(v) => {
                const id = v === NONE ? null : Number(v);
                const next = sources.find((s) => s.id === id);
                patch(i, { sourceId: id, unitPrice: priceOf(next, l.kind) || l.unitPrice });
              }}
            >
              <SelectTrigger className="col-span-2 md:col-span-1">
                <SelectValue placeholder="选择来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>未指定</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className="tabular-nums"
              aria-label="数量"
              value={l.quantity}
              onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="tabular-nums"
              aria-label="单价"
              value={l.unitPrice}
              onChange={(e) => patch(i, { unitPrice: Number(e.target.value) })}
            />

            <span className="text-sm tabular-nums text-muted-foreground text-right md:text-left">
              {fmtMoneyShort((l.quantity || 0) * (l.unitPrice || 0))}
            </span>

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
        );
      })}
    </LineItemsFrame>
  );
}
