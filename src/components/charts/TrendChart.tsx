"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, chartTheme } from "@/lib/chart-theme";
import { fmtMoneyShort } from "@/lib/format";

export interface Series {
  key: string;
  name: string;
  color: string;
}

export default function TrendChart({
  data,
  series,
  height = 288,
  xKey = "label",
  zeroLine = false,
  emptyText = "暂无数据",
}: {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  xKey?: string;
  zeroLine?: boolean;
  emptyText?: string;
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
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
        {zeroLine && <ReferenceLine y={0} stroke={chartTheme.grid} />}
        <XAxis
          dataKey={xKey}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chartTheme.grid }}
          minTickGap={32}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => fmtMoneyShort(Number(v), 1)}
        />
        <Tooltip
          contentStyle={chartTheme.tooltip}
          labelStyle={chartTheme.tooltipLabel}
          cursor={{ stroke: chartTheme.grid }}
          formatter={((v: unknown) => fmtMoneyShort(Number(v) || 0)) as never}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
