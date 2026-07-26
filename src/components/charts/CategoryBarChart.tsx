"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, categoryPalette, chartTheme } from "@/lib/chart-theme";
import { fmtMoneyShort } from "@/lib/format";

export interface CategoryDatum {
  label: string;
  value: number;
}

/// 分类排行条形图。layout="vertical" 时标签横排在左侧, 中文标签更好读。
export default function CategoryBarChart({
  data,
  height = 260,
  vertical = true,
  emptyText = "暂无数据",
  valueFormatter = (v: number) => fmtMoneyShort(v),
}: {
  data: CategoryDatum[];
  height?: number;
  vertical?: boolean;
  emptyText?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        {emptyText}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
        <CartesianGrid
          stroke={chartTheme.grid}
          strokeDasharray="3 3"
          horizontal={!vertical}
          vertical={vertical}
        />
        {vertical ? (
          <>
            <XAxis
              type="number"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => valueFormatter(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={92}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => valueFormatter(Number(v))}
            />
          </>
        )}
        <Tooltip
          contentStyle={chartTheme.tooltip}
          labelStyle={chartTheme.tooltipLabel}
          cursor={{ fill: chartTheme.cursor }}
          formatter={((v: unknown) => valueFormatter(Number(v) || 0)) as never}
        />
        <Bar dataKey="value" radius={4}>
          {data.map((_, i) => (
            <Cell key={i} fill={categoryPalette[i % categoryPalette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
