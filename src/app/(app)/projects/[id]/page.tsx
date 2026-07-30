"use client";
import { use, useEffect, useState } from "react";
import { Percent, Receipt, TrendingUp, Wallet } from "lucide-react";
import CategoryBarChart from "@/components/charts/CategoryBarChart";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import RecordDetailDialog, { type DetailField } from "@/components/RecordDetailDialog";
import StatCard from "@/components/StatCard";
import { useCan } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
  PURCHASE_KIND_LABEL,
  BATCH_STATUS_LABEL,
  BATCH_STATUS_VARIANT,
  type BatchStatus,
  type ProjectStatus,
  type PurchaseKind,
} from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";

interface Detail {
  project: {
    id: number;
    code: string;
    ownerName: string;
    name: string;
    status: ProjectStatus;
    description: string;
    owner: { id: number; displayName: string } | null;
  };
  desks:
    | {
        id: number;
        name: string;
        status: string;
        baseUrl: string;
        demand: string;
        owner: { displayName: string };
        items: { quantity: number; unitPrice: number | null }[];
      }[]
    | null;
  purchases:
    | {
        id: number;
        purchaseDate: string;
        kind: PurchaseKind;
        content: string;
        detail: string | null;
        purchaserName: string;
        totalAmount: number | null;
        purchaser: { displayName: string };
      }[]
    | null;
  batches:
    | {
        id: number;
        batchDate: string;
        quantity: number;
        status: BatchStatus;
        product: { name: string };
        operator: { displayName: string };
        note: string;
        resultData: string;
      }[]
    | null;
}

interface Profit {
  revenue: number;
  cost: number;
  purchaseCost: number;
  supplierCost: number;
  profit: number;
  margin: number;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const showProfit = can("profit");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ title: string; fields: DetailField[] } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<{ item: Detail }>(`/api/projects/${id}/detail`),
      // 利润接口只有财务/管理员有权限, 其他角色静默降级
      showProfit
        ? api.get<{ item: Profit }>(`/api/projects/${id}/profit`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([d, p]) => {
        if (!alive) return;
        setDetail(d.item);
        setProfit(p?.item ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [id, showProfit]);

  const p = detail?.project;

  return (
    <>
      <PageHeader
        back="/projects"
        title={p?.name ?? "项目详情"}
        subtitle={p ? `负责人 ${p.ownerName || p.owner?.displayName || "-"}` : undefined}
        actions={
          p && (
            <Badge variant={PROJECT_STATUS_VARIANT[p.status]}>
              {PROJECT_STATUS_LABEL[p.status]}
            </Badge>
          )
        }
      />

      <DataState loading={loading} error={error} empty={!detail}>
        {profit && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <StatCard
                label="总收入"
                value={fmtMoneyShort(profit.revenue)}
                icon={TrendingUp}
                accent="success"
              />
              <StatCard
                label="总成本"
                value={fmtMoneyShort(profit.cost)}
                hint={`采购 ${fmtMoneyShort(profit.purchaseCost)} · 进货 ${fmtMoneyShort(profit.supplierCost)}`}
                icon={Receipt}
                accent="warning"
                positiveIsGood={false}
              />
              <StatCard
                label="净利润"
                value={fmtMoneyShort(profit.profit)}
                icon={Wallet}
                accent={profit.profit >= 0 ? "primary" : "danger"}
              />
              <StatCard
                label="利润率"
                value={`${(profit.margin * 100).toFixed(1)}%`}
                icon={Percent}
                accent="default"
              />
            </div>

            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">成本构成</CardTitle>
                <CardDescription>
                  供货方明细里「已进货量」为 0 的行只是报价，不计入成本
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <CategoryBarChart
                  data={[
                    { label: "采购记录", value: profit.purchaseCost },
                    { label: "供货方进货", value: profit.supplierCost },
                  ].filter((d) => d.value > 0)}
                  height={140}
                  emptyText="还没有发生成本"
                />
              </CardContent>
            </Card>
          </>
        )}

        <Tabs defaultValue={detail?.desks ? "desks" : detail?.purchases ? "purchases" : "batches"}>
          <TabsList>
            {detail?.desks && <TabsTrigger value="desks">台子</TabsTrigger>}
            {detail?.purchases && <TabsTrigger value="purchases">采购</TabsTrigger>}
            {detail?.batches && <TabsTrigger value="batches">产出批次</TabsTrigger>}
          </TabsList>

          {detail?.desks && (
            <TabsContent value="desks" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {detail.desks.length === 0 ? (
                    <Empty text="该项目下还没有台子" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>台子</TableHead>
                          <TableHead>归属销售</TableHead>
                          <TableHead className="text-right">货明细</TableHead>
                          <TableHead className="text-right">卖价合计</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.desks.map((d) => (
                          <TableRow key={d.id} className="cursor-pointer" onClick={() => setViewing({ title: "台子详情", fields: [{ label: "台子名称", value: d.name }, { label: "归属销售", value: d.owner.displayName }, { label: "Base URL", value: d.baseUrl }, { label: "状态", value: d.status }, { label: "需求说明", value: d.demand, wide: true }, { label: "卖价明细", value: d.items.map((item) => fmtMoneyShort(item.unitPrice ?? 0)).join(" / ") || "-", wide: true }] })}>
                            <TableCell className="font-medium">{d.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {d.owner.displayName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {d.items.length} 项
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoneyShort(
                                d.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0),
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {detail?.purchases && (
            <TabsContent value="purchases" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {detail.purchases.length === 0 ? (
                    <Empty text="该项目下还没有采购记录" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日期</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>内容</TableHead>
                          <TableHead>采购人</TableHead>
                          <TableHead className="text-right">金额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.purchases.map((r) => (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewing({ title: "采购详情", fields: [{ label: "日期", value: r.purchaseDate }, { label: "类型", value: PURCHASE_KIND_LABEL[r.kind] }, { label: "采购人", value: r.purchaserName || r.purchaser.displayName }, { label: "金额", value: r.totalAmount === null ? "-" : fmtMoneyShort(r.totalAmount) }, { label: "采购内容", value: r.content, wide: true }, { label: "花费详情", value: r.detail, wide: true }] })}>
                            <TableCell className="font-mono text-xs">{r.purchaseDate}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{PURCHASE_KIND_LABEL[r.kind]}</Badge>
                            </TableCell>
                            <TableCell>{r.content}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.purchaser.displayName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {r.totalAmount === null ? "···" : fmtMoneyShort(r.totalAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}


          {detail?.batches && (
            <TabsContent value="batches" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {detail.batches.length === 0 ? (
                    <Empty text="该项目下还没有产出批次" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日期</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead className="text-right">数量</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>生产人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.batches.map((b) => (
                          <TableRow key={b.id} className="cursor-pointer" onClick={() => setViewing({ title: "产出批次详情", fields: [{ label: "日期", value: b.batchDate }, { label: "状态", value: BATCH_STATUS_LABEL[b.status] }, { label: "产品", value: b.product.name }, { label: "数量", value: b.quantity.toLocaleString("en-US") }, { label: "生产人", value: b.operator.displayName }, { label: "备注", value: b.note, wide: true }, { label: "产出信息", value: b.resultData, wide: true }] })}>
                            <TableCell className="font-mono text-xs">{b.batchDate}</TableCell>
                            <TableCell className="font-medium">{b.product.name}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.quantity.toLocaleString("en-US")}
                            </TableCell>
                            <TableCell><Badge variant={BATCH_STATUS_VARIANT[b.status]}>{BATCH_STATUS_LABEL[b.status]}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">
                              {b.operator.displayName}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
        <RecordDetailDialog open={viewing !== null} onOpenChange={(value) => !value && setViewing(null)} title={viewing?.title ?? "详情"} fields={viewing?.fields ?? []} />
      </DataState>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-12 text-center">{text}</p>;
}
