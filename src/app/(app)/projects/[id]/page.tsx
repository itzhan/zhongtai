"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MoreHorizontal,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import TrendChart from "@/components/charts/TrendChart";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import RoleGate from "@/components/RoleGate";
import { useCan, useSession } from "@/components/RoleProvider";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProductOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { seriesColor } from "@/lib/chart-theme";
import {
  BATCH_STATUS_LABEL,
  BATCH_STATUS_VARIANT,
  DESK_API_KIND,
  DESK_API_KIND_LABEL,
  DESK_API_KIND_VARIANT,
  FINANCE_KIND,
  FINANCE_KIND_LABEL,
  FINANCE_KIND_VARIANT,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
  type BatchStatus,
  type DeskApiKind,
  type FinanceKind,
  type ProjectStatus,
} from "@/lib/enums";
import { fmtMoneyShort, todayStr } from "@/lib/format";
import { ROLES } from "@/lib/rbac";

interface Demand {
  id: number;
  productId: number | null;
  productName: string;
  spec: string;
  quantity: number | null;
  note: string;
  product: { id: number; name: string } | null;
}

interface DeskRow {
  id: number;
  name: string;
  status: string;
  baseUrl: string;
  apiKind: DeskApiKind | string;
  apiToken: string | null;
  demand: string;
  owner: { displayName: string };
  items: { quantity: number; unitPrice: number | null; productName?: string }[];
}

interface Entry {
  id: number;
  kind: FinanceKind;
  amount: number | null;
  note: string;
  entryDate: string;
  creatorName: string;
  createdBy: { id: number; displayName: string } | null;
}

interface Batch {
  id: number;
  batchDate: string;
  quantity: number;
  status: BatchStatus;
  product: { name: string };
  operator: { displayName: string };
  note: string;
  resultData: string;
}

interface Detail {
  project: {
    id: number;
    code: string;
    ownerName: string;
    name: string;
    status: ProjectStatus;
    description: string;
    enableDemands: boolean;
    enableBatches: boolean;
    owner: { id: number; displayName: string } | null;
  };
  /// 成本/收入必有；demands/batches 仅项目勾选后返回
  entries: Entry[] | null;
  desks: DeskRow[] | null;
  demands: Demand[] | null;
  batches: Batch[] | null;
}

interface Profit {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  daily: { date: string; label: string; income: number; cost: number; profit: number }[];
}

interface UsageInfo {
  deskId: number;
  apiKind: string;
  placeholder: boolean;
  usedUsd: number | null;
  message: string;
}

const ENTRY_EDITORS = [ROLES.ADMIN, ROLES.FINANCE, ROLES.SALES, ROLES.RESOURCE];
const DEMAND_EDITORS = [ROLES.ADMIN, ROLES.FINANCE, ROLES.SALES];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const session = useSession();
  const showProfit = can("profit");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryFilter, setEntryFilter] = useState<"all" | FinanceKind>("all");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);

  const [demandOpen, setDemandOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [deletingDemand, setDeletingDemand] = useState<Demand | null>(null);

  const [usageMap, setUsageMap] = useState<Record<number, UsageInfo | "loading" | "error">>({});

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ item: Detail }>(`/api/projects/${id}/detail`),
      showProfit
        ? api.get<{ item: Profit }>(`/api/projects/${id}/profit?days=30`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([d, p]) => {
        setDetail(d.item);
        setProfit(p?.item ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id, showProfit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredEntries = useMemo(() => {
    const list = detail?.entries ?? [];
    if (entryFilter === "all") return list;
    return list.filter((e) => e.kind === entryFilter);
  }, [detail?.entries, entryFilter]);

  const canWriteEntry = (kind: FinanceKind) => {
    if (session.role === ROLES.ADMIN || session.role === ROLES.FINANCE) return true;
    if (session.role === ROLES.SALES) return kind === "income";
    if (session.role === ROLES.RESOURCE) return kind === "cost";
    return false;
  };

  async function fetchUsage(deskId: number) {
    setUsageMap((m) => ({ ...m, [deskId]: "loading" }));
    try {
      const res = await api.get<{ item: UsageInfo }>(`/api/desks/${deskId}/usage`);
      setUsageMap((m) => ({ ...m, [deskId]: res.item }));
    } catch {
      setUsageMap((m) => ({ ...m, [deskId]: "error" }));
    }
  }

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
                <CardTitle className="text-base">逐日利润</CardTitle>
                <CardDescription>近 30 天 · 收入流水 − 成本流水</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <TrendChart
                  data={profit.daily}
                  series={[{ key: "profit", name: "利润", color: seriesColor.profit }]}
                  xKey="label"
                  zeroLine
                  height={260}
                  emptyText="还没有收支流水"
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* 1. 成本 / 收入记录（必有） */}
        {detail?.entries !== null && detail?.entries !== undefined && (
          <Card className="mb-4">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">成本 / 收入记录</CardTitle>
                <CardDescription>直接记账；成本会同步出现在采购页</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Tabs
                  value={entryFilter}
                  onValueChange={(v) => setEntryFilter(v as "all" | FinanceKind)}
                >
                  <TabsList>
                    <TabsTrigger value="all">全部</TabsTrigger>
                    <TabsTrigger value="income">收入</TabsTrigger>
                    <TabsTrigger value="cost">成本</TabsTrigger>
                  </TabsList>
                </Tabs>
                <RoleGate roles={ENTRY_EDITORS}>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setEditingEntry(null);
                      setEntryOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    新增记录
                  </Button>
                </RoleGate>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
              {filteredEntries.length === 0 ? (
                <Empty text="还没有记录" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>方向</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>介绍</TableHead>
                      <TableHead>录入人</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.entryDate}</TableCell>
                        <TableCell>
                          <Badge variant={FINANCE_KIND_VARIANT[e.kind]}>
                            {FINANCE_KIND_LABEL[e.kind]}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            e.kind === "income" ? "text-success" : "text-warning"
                          }`}
                        >
                          {e.amount === null ? "···" : fmtMoneyShort(e.amount)}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate">{e.note || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.creatorName || e.createdBy?.displayName || "-"}
                        </TableCell>
                        <TableCell>
                          {canWriteEntry(e.kind) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" aria-label="更多">
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingEntry(e);
                                    setEntryOpen(true);
                                  }}
                                >
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeletingEntry(e)}
                                >
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* 2. 台子信息（可空） */}
        {detail?.desks && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">台子信息</CardTitle>
              <CardDescription>
                用于查看下游消耗（NewAPI / Sub2API），不绑台子的中转项目可留空
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t">
              {detail.desks.length === 0 ? (
                <Empty text="该项目暂无台子" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>台子</TableHead>
                      <TableHead>归属销售</TableHead>
                      <TableHead>API</TableHead>
                      <TableHead>消耗</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.desks.map((d) => {
                      const kind = (DESK_API_KIND.includes(d.apiKind as DeskApiKind)
                        ? d.apiKind
                        : "none") as DeskApiKind;
                      const usage = usageMap[d.id];
                      return (
                        <TableRow key={d.id}>
                          <TableCell>
                            <p className="font-medium">{d.name}</p>
                            {d.baseUrl && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {d.baseUrl}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {d.owner.displayName}
                          </TableCell>
                          <TableCell>
                            <Badge variant={DESK_API_KIND_VARIANT[kind]}>
                              {DESK_API_KIND_LABEL[kind]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {usage === "loading" ? (
                              <span className="text-muted-foreground">拉取中…</span>
                            ) : usage === "error" ? (
                              <span className="text-destructive">拉取失败</span>
                            ) : usage ? (
                              <span className="text-muted-foreground">
                                {usage.usedUsd == null
                                  ? usage.message
                                  : `$${usage.usedUsd} · ${usage.message}`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">未拉取</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              disabled={kind === "none" || usage === "loading"}
                              onClick={() => fetchUsage(d.id)}
                            >
                              <RefreshCw size={12} />
                              刷新
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. 甲方需求清单（项目勾选后才显示） */}
        {detail?.demands && (
          <Card className="mb-4">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">甲方需求清单</CardTitle>
                <CardDescription>这个项目甲方需要什么货</CardDescription>
              </div>
              <RoleGate roles={DEMAND_EDITORS}>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setEditingDemand(null);
                    setDemandOpen(true);
                  }}
                >
                  <Plus size={14} />
                  添加需求
                </Button>
              </RoleGate>
            </CardHeader>
            <CardContent className="p-0 border-t">
              {detail.demands.length === 0 ? (
                <Empty text="还没有需求，点右上角添加" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>货名</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.demands.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.productName}</TableCell>
                        <TableCell className="text-muted-foreground">{d.spec || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.quantity == null ? "-" : d.quantity.toLocaleString("en-US")}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {d.note || "-"}
                        </TableCell>
                        <TableCell>
                          <RoleGate roles={DEMAND_EDITORS}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" aria-label="更多">
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingDemand(d);
                                    setDemandOpen(true);
                                  }}
                                >
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeletingDemand(d)}
                                >
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </RoleGate>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* 4. 产出批次（项目勾选后才显示） */}
        {detail?.batches && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">产出批次</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
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
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.batchDate}</TableCell>
                        <TableCell className="font-medium">{b.product.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.quantity.toLocaleString("en-US")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={BATCH_STATUS_VARIANT[b.status]}>
                            {BATCH_STATUS_LABEL[b.status]}
                          </Badge>
                        </TableCell>
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
        )}
      </DataState>

      <DemandDialog
        open={demandOpen}
        onOpenChange={setDemandOpen}
        projectId={id}
        initial={editingDemand}
        onSaved={reload}
      />

      <EntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        projectId={id}
        initial={editingEntry}
        role={session.role}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deletingDemand !== null}
        onOpenChange={(v) => !v && setDeletingDemand(null)}
        title={`删除需求「${deletingDemand?.productName ?? ""}」？`}
        description="删除后可从回收逻辑中恢复前不可见。"
        onConfirm={async () => {
          if (!deletingDemand) return;
          const ok = await mutate(
            () => api.del(`/api/projects/${id}/demands/${deletingDemand.id}`),
            { success: "已删除", error: "删除失败" },
          );
          setDeletingDemand(null);
          if (ok) reload();
        }}
      />

      <ConfirmDialog
        open={deletingEntry !== null}
        onOpenChange={(v) => !v && setDeletingEntry(null)}
        title="删除这条记录？"
        description="删除后项目利润会相应变化。"
        onConfirm={async () => {
          if (!deletingEntry) return;
          const ok = await mutate(() => api.del(`/api/entries/${deletingEntry.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          setDeletingEntry(null);
          if (ok) reload();
        }}
      />
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-12 text-center">{text}</p>;
}

function DemandDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial: Demand | null;
  onSaved: () => void;
}) {
  const products = useProductOptions(open);
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [spec, setSpec] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(initial?.productId ? String(initial.productId) : "");
    setProductName(initial?.productName ?? "");
    setSpec(initial?.spec ?? "");
    setQuantity(initial?.quantity != null ? String(initial.quantity) : "");
    setNote(initial?.note ?? "");
  }, [open, initial]);

  async function save() {
    if (!productName.trim()) return toast.warning("请填写货名");
    let qty: number | null = null;
    if (quantity.trim()) {
      const n = Number(quantity);
      if (!Number.isFinite(n) || n < 0) return toast.warning("数量非法");
      qty = n;
    }

    const payload = {
      productId: productId ? Number(productId) : null,
      productName: productName.trim(),
      spec,
      quantity: qty,
      note,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/projects/${projectId}/demands/${initial.id}`, payload)
            : api.post(`/api/projects/${projectId}/demands`, payload),
        { success: initial ? "已保存" : "已添加", error: "保存失败" },
      );
      if (ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑需求" : "添加需求"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="关联产品" hint="可选，选中后会回填货名">
            <Select
              value={productId || "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  setProductId("");
                  return;
                }
                setProductId(v);
                const found = products.find((p) => String(p.id) === v);
                if (found) setProductName(found.name);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="不关联" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不关联</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="货名" required>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="甲方要的货"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="规格">
              <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="规格说明" />
            </Field>
            <Field label="数量">
              <Input
                type="number"
                min={0}
                step="any"
                className="tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
          </div>
          <Field label="备注">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  role,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial: Entry | null;
  role: string;
  onSaved: () => void;
}) {
  const defaultKind: FinanceKind =
    role === ROLES.RESOURCE ? "cost" : role === ROLES.SALES ? "income" : "cost";

  const [kind, setKind] = useState<FinanceKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const kindOptions = useMemo(() => {
    if (role === ROLES.SALES) return ["income"] as FinanceKind[];
    if (role === ROLES.RESOURCE) return ["cost"] as FinanceKind[];
    return [...FINANCE_KIND];
  }, [role]);

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? defaultKind);
    setAmount(initial?.amount != null ? String(initial.amount) : "");
    setEntryDate(initial?.entryDate ?? todayStr());
    setNote(initial?.note ?? "");
  }, [open, initial, defaultKind]);

  async function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return toast.warning("金额非法");
    if (!entryDate) return toast.warning("请选择日期");
    if (!note.trim()) return toast.warning("请填写介绍");

    const payload = { kind, amount: amt, entryDate, note: note.trim() };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/entries/${initial.id}`, payload)
            : api.post(`/api/projects/${projectId}/entries`, payload),
        { success: initial ? "已保存" : "已记账", error: "保存失败" },
      );
      if (ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑记录" : "新增记录"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="方向" required>
            {kindOptions.length === 1 ? (
              <Input value={FINANCE_KIND_LABEL[kindOptions[0]]} disabled />
            ) : (
              <Tabs value={kind} onValueChange={(v) => setKind(v as FinanceKind)}>
                <TabsList className="w-full">
                  {kindOptions.map((k) => (
                    <TabsTrigger key={k} value={k} className="flex-1">
                      {FINANCE_KIND_LABEL[k]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="金额" required>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="日期" required>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
          </div>
          <Field label="介绍" required hint="本次花销或收入说明">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：上游结算 200 刀 / 甲方回款"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
