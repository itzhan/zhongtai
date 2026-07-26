"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Factory,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import CategoryBarChart from "@/components/charts/CategoryBarChart";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useSession } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { fmtMoneyShort } from "@/lib/format";
import { statusVariant } from "@/lib/product-status";

/// 后端只回图标名, 组件映射在这里 —— API 层不该 import lucide。
const ICONS: Record<string, LucideIcon> = {
  package: Package,
  store: Store,
  wallet: Wallet,
  factory: Factory,
  boxes: Boxes,
  cart: ShoppingCart,
  trending: TrendingUp,
  receipt: Receipt,
};

interface StatCardData {
  key: string;
  label: string;
  value: string;
  hint?: string;
  accent: "primary" | "success" | "danger" | "warning" | "default";
  icon: string;
  positiveIsGood?: boolean;
}

interface DashboardData {
  role: string;
  days: number;
  cards: StatCardData[];
  blocks: {
    products?: { id: number; name: string; status: string | null; capacity: string | null }[];
    desks?: {
      id: number;
      name: string;
      owner: string;
      project: string;
      itemCount: number;
      amount: number;
    }[];
    output?: { label: string; value: number }[];
    resources?: { email: number; proxy: number; card: number; sources: number };
    projectProfits?: {
      id: number;
      code: string;
      name: string;
      revenue: number;
      cost: number;
      profit: number;
      margin: number;
    }[];
  };
}

export default function DashboardPage() {
  const session = useSession();
  const [days, setDays] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<{ item: DashboardData }>(`/api/dashboard?days=${days}`)
      .then((r) => alive && setData(r.item))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  const b = data?.blocks ?? {};

  return (
    <>
      <PageHeader
        title={`${greeting()}，${session.displayName}`}
        subtitle="产品、台子、生产与资源概览"
        actions={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
              <SelectItem value="90">近 90 天</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <DataState loading={loading} error={error} empty={!data}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {data?.cards.map((c) => (
            <StatCard
              key={c.key}
              label={c.label}
              value={c.value}
              hint={c.hint}
              accent={c.accent}
              icon={ICONS[c.icon]}
              positiveIsGood={c.positiveIsGood}
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {b.projectProfits && b.projectProfits.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">项目利润</CardTitle>
                <CardDescription>
                  收入来自台子卖价，成本来自采购与已进货的供货明细
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>项目</TableHead>
                      <TableHead className="text-right">收入</TableHead>
                      <TableHead className="text-right">成本</TableHead>
                      <TableHead className="text-right">利润</TableHead>
                      <TableHead className="text-right">利润率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.projectProfits.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/projects/${p.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {p.name}
                          </Link>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">
                            {p.code}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoneyShort(p.revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoneyShort(p.cost)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            p.profit >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {fmtMoneyShort(p.profit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {(p.margin * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {b.desks && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">台子情况</CardTitle>
                <CardDescription>按创建时间倒序，最多 8 条</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {b.desks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">还没有台子</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>台子</TableHead>
                        <TableHead>销售</TableHead>
                        <TableHead className="text-right">需求</TableHead>
                        <TableHead className="text-right">卖价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b.desks.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{d.owner}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.itemCount} 项
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtMoneyShort(d.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {b.output && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">生产情况</CardTitle>
                <CardDescription>近 {data?.days} 天各产品产出量</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <CategoryBarChart
                  data={b.output}
                  height={220}
                  emptyText="这个时间段还没有产出"
                  valueFormatter={(v) => v.toLocaleString("en-US")}
                />
              </CardContent>
            </Card>
          )}

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">产品情况</CardTitle>
              <CardDescription>状态与产能都是自由文本，颜色按关键词推导</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {!b.products || b.products.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">还没有产品</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {b.products.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border p-3 space-y-2 min-w-0">
                      <p className="text-sm font-medium truncate" title={p.name}>
                        {p.name}
                      </p>
                      <Badge variant={statusVariant(p.status)} className="max-w-full">
                        <span className="truncate">{p.status?.trim() || "未填写状态"}</span>
                      </Badge>
                      <p className="text-xs text-muted-foreground truncate">
                        产能：{p.capacity?.trim() || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {b.resources && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">资源情况</CardTitle>
                <CardDescription>当前可用的基础资源</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "可用邮箱", value: b.resources.email, href: "/resources/emails" },
                  { label: "可用代理 IP", value: b.resources.proxy, href: "/resources/proxies" },
                  { label: "可用卡", value: b.resources.card, href: "/resources/cards" },
                  { label: "启用来源", value: b.resources.sources, href: "/resources/sources" },
                ].map((r) => (
                  <Link
                    key={r.label}
                    href={r.href}
                    className="rounded-xl border border-border p-3 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      {r.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight tabular-nums mt-1">{r.value}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </DataState>
    </>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}
