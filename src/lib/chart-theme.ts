// 图表主题 —— recharts 只吃 CSS 字符串不吃 Tailwind class, 所以这里是
// 全项目【唯一】允许写颜色字面量的地方, 而且写的仍然是语义 token,
// 改主题 / 切暗色都会自动跟随。
import type { CSSProperties } from "react";

export const chartTheme = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  cursor: "hsl(var(--foreground) / 0.05)",
  tooltip: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12, // 对齐 --radius: 0.75rem
    fontSize: 12,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  } as CSSProperties,
  tooltipLabel: { color: "hsl(var(--foreground))" } as CSSProperties,
} as const;

/// 语义系列色 —— 和 Badge 的 success/destructive 同源。
export const seriesColor = {
  revenue: "hsl(var(--success))",
  cost: "hsl(var(--destructive))",
  profit: "hsl(var(--primary))",
} as const;

/// 分类色板 (项目/类型排行用), 5 色循环。
export const categoryPalette = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--purple))",
  "hsl(var(--info))",
] as const;

export const axisTick = { fill: chartTheme.axis, fontSize: 11 } as const;
