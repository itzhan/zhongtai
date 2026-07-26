"use client";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/// 明细行编辑器的【外壳】—— 表头 + 行插槽 + 「添加一行」+ 合计。
///
/// 刻意只共享外壳、不泛型化行渲染: 台子的行是「产品/数量/单价/备注」,
/// 消耗申报的行是「资源类型/来源/数量/单价/小计」, 编辑器类型完全不同。
/// 泛型化要引入 column descriptor + 渲染函数, 代码量反而超过各写各的。
/// 视觉一致性由这个外壳保证就够了。
export default function LineItemsFrame({
  cols,
  header,
  total,
  totalLabel = "合计",
  onAdd,
  addLabel = "添加一行",
  emptyText = "还没有明细，点下方「添加一行」",
  isEmpty,
  children,
}: {
  /// grid-template-columns, 如 "1fr 90px 110px 1fr 36px"。行渲染要用同一个值
  cols: string;
  header: React.ReactNode[];
  total: React.ReactNode;
  totalLabel?: string;
  onAdd: () => void;
  addLabel?: string;
  emptyText?: string;
  isEmpty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div
        className="hidden md:grid gap-2 px-3 py-2 border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50"
        style={{ gridTemplateColumns: cols }}
      >
        {header.map((h, i) => (
          <div key={i}>{h}</div>
        ))}
      </div>

      {isEmpty ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border">{children}</div>
      )}

      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-muted/20">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Plus size={14} />
          {addLabel}
        </button>
        <div className="text-sm">
          <span className="text-muted-foreground mr-2">{totalLabel}</span>
          <span className="font-semibold tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

/// 一行的容器 —— 移动端两列堆叠, md 以上切到 cols 定义的模板列。
/// 模板列走 CSS 变量 + Tailwind arbitrary property, 这样断点行为由
/// Tailwind 管, 不需要在组件里写媒体查询。
export function LineItemRow({
  cols,
  className,
  children,
}: {
  cols: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 p-2 md:px-3 items-center",
        "md:[grid-template-columns:var(--line-cols)]",
        className,
      )}
      style={{ ["--line-cols" as string]: cols }}
    >
      {children}
    </div>
  );
}
