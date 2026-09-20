"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import RoleGate from "@/components/RoleGate";
import { useCan, useSession } from "@/components/RoleProvider";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api, mutate } from "@/lib/api-client";
import {
  COST_SOURCE,
  COST_SOURCE_LABEL,
  COST_SOURCE_VARIANT,
  DESK_API_KIND,
  DESK_API_KIND_LABEL,
  DESK_API_KIND_VARIANT,
  FINANCE_KIND,
  FINANCE_KIND_LABEL,
  FINANCE_KIND_VARIANT,
  FUND_CURRENCY,
  FUND_CURRENCY_LABEL,
  PAY_CHANNEL,
  PAY_CHANNEL_LABEL,
  PAY_CHANNEL_VARIANT,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
  isOneOf,
  type CostSource,
  type DeskApiKind,
  type FinanceKind,
  type FundCurrency,
  type PayChannel,
  type PartyKind,
  type ProjectStatus,
} from "@/lib/enums";
import PartyLink from "@/components/PartyLink";
import PartyPicker from "@/components/PartyPicker";
import PurposeCell from "@/components/PurposeCell";
import { fmtLedgerAmount, fmtMoneyShort, todayStr } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import type { Desk } from "../../desks/types";
import { useMemberOptions, usePartnerOptions, useSupplierOptions } from "@/hooks/use-options";

interface Demand {
  id: number;
  productId: number | null;
  productName: string;
  sellPrice: number;
  note: string;
}

interface DeskRow {
  id: number;
  name: string;
  status: string;
  baseUrl: string;
  apiKind: DeskApiKind | string;
  apiToken: string | null;
  demand: string;
  ownerName: string;
  owner: { displayName: string };
  items: { quantity: number; unitPrice: number | null; productName?: string }[];
}

interface Entry {
  id: number;
  kind: FinanceKind;
  amount: number | null;
  currency?: string;
  channel?: string;
  fromKind?: string;
  fromId?: number | null;
  fromName?: string;
  toKind?: string;
  toId?: number | null;
  toName?: string;
  note: string;
  entryDate: string;
  creatorName: string;
  costSource?: CostSource | string;
  supplierId?: number | null;
  createdBy: { id: number; displayName: string } | null;
  supplier?: { id: number; name: string } | null;
}

interface Detail {
  project: {
    id: number;
    code: string;
    name: string;
    status: ProjectStatus;
    description: string;
    enableDemands?: boolean;
    enableBatches?: boolean;
    enableDesks?: boolean;
  };
  entries: Entry[] | null;
  desks: DeskRow[] | null;
  demands: Demand[] | null;
}

interface Profit {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
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
const PAGE_SIZES = [10, 30, 50, 100] as const;

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
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [entryQ, setEntryQ] = useState("");
  const [entryChannel, setEntryChannel] = useState("all");
  const [entryFrom, setEntryFrom] = useState("");
  const [entryTo, setEntryTo] = useState("");
  const [entryParty, setEntryParty] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);

  const [demandOpen, setDemandOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [deletingDemand, setDeletingDemand] = useState<Demand | null>(null);

  const [attachOpen, setAttachOpen] = useState(false);
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

  useEffect(() => {
    setPage(1);
  }, [entryFilter, creatorFilter, entryQ, entryChannel, entryFrom, entryTo, entryParty, pageSize]);

  const filteredEntries = useMemo(() => {
    const list = detail?.entries ?? [];
    const needle = entryQ.trim().toLowerCase();
    return list.filter((e) => {
      if (entryFilter !== "all" && e.kind !== entryFilter) return false;
      if (creatorFilter !== "all" && e.creatorName !== creatorFilter) return false;
      if (entryChannel !== "all" && e.channel !== entryChannel) return false;
      if (entryFrom && e.entryDate < entryFrom) return false;
      if (entryTo && e.entryDate > entryTo) return false;
      if (entryParty !== "all") {
        const [kind, id] = entryParty.split(":");
        const match =
          (e.fromKind === kind && String(e.fromId) === id) || (e.toKind === kind && String(e.toId) === id);
        if (!match) return false;
      }
      if (needle) {
        const hay = `${e.note} ${e.fromName ?? ""} ${e.toName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [detail?.entries, entryFilter, creatorFilter, entryQ, entryChannel, entryFrom, entryTo, entryParty]);

  const creators = useMemo(() => {
    const names = new Set((detail?.entries ?? []).map((item) => item.creatorName).filter(Boolean));
    return [...names];
  }, [detail?.entries]);

  const entryParties = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of detail?.entries ?? []) {
      if (e.fromId && e.fromName) map.set(`${e.fromKind}:${e.fromId}`, e.fromName);
      if (e.toId && e.toName) map.set(`${e.toKind}:${e.toId}`, e.toName);
    }
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [detail?.entries]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedEntries = filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

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
        subtitle={p ? p.code : undefined}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard label="总收入" value={fmtMoneyShort(profit.revenue)} icon={TrendingUp} accent="success" />
            <StatCard label="总成本" value={fmtMoneyShort(profit.cost)} icon={Receipt} accent="warning" positiveIsGood={false} />
            <StatCard
              label="净利润"
              value={fmtMoneyShort(profit.profit)}
              icon={Wallet}
              accent={profit.profit >= 0 ? "primary" : "danger"}
            />
            <StatCard label="利润率" value={`${(profit.margin * 100).toFixed(1)}%`} icon={Percent} accent="default" />
          </div>
        )}

        {detail?.demands !== null && detail?.demands !== undefined && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ClipboardList size={14} />
              </span>
              <span className="text-sm font-medium">甲方需求</span>
            </div>
            <span className="h-4 w-px shrink-0 bg-border" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {detail.demands.length === 0 ? (
                <span className="text-sm text-muted-foreground">还没有需求</span>
              ) : (
                detail.demands.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex max-w-[18rem] items-start gap-2 rounded-lg bg-muted/70 px-2.5 py-1.5"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left hover:text-primary"
                      onClick={() => {
                        setEditingDemand(d);
                        setDemandOpen(true);
                      }}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">{d.productName}</span>
                        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                          {fmtDemandPrice(d.sellPrice)}
                        </span>
                      </span>
                      {d.note ? (
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground" title={d.note}>
                          {d.note}
                        </span>
                      ) : null}
                    </button>
                    <RoleGate roles={DEMAND_EDITORS}>
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-muted-foreground/70 hover:text-destructive"
                        aria-label={`删除 ${d.productName}`}
                        onClick={() => setDeletingDemand(d)}
                      >
                        ×
                      </button>
                    </RoleGate>
                  </span>
                ))
              )}
            </div>
            <RoleGate roles={DEMAND_EDITORS}>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={() => {
                  setEditingDemand(null);
                  setDemandOpen(true);
                }}
              >
                <Plus size={14} />
                添加
              </Button>
            </RoleGate>
          </div>
        )}

        {detail?.entries !== null && detail?.entries !== undefined && (
          <Card className="mb-4">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-3">
              <CardTitle className="text-base shrink-0">成本 / 收入记录</CardTitle>
              <div className="flex items-center justify-end gap-2 overflow-x-auto">
                <Input
                  className="h-8 w-40"
                  placeholder="搜索用途 / 人名"
                  value={entryQ}
                  onChange={(e) => setEntryQ(e.target.value)}
                />
                <Select value={entryFilter} onValueChange={(v) => setEntryFilter(v as "all" | FinanceKind)}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部方向</SelectItem>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="cost">成本</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entryParty} onValueChange={setEntryParty}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="人员" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部人员</SelectItem>
                    {entryParties.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={entryChannel} onValueChange={setEntryChannel}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部渠道</SelectItem>
                    {PAY_CHANNEL.map((c) => (
                      <SelectItem key={c} value={c}>
                        {PAY_CHANNEL_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" className="h-8 w-36" value={entryFrom} onChange={(e) => setEntryFrom(e.target.value)} aria-label="开始日期" />
                <Input type="date" className="h-8 w-36" value={entryTo} onChange={(e) => setEntryTo(e.target.value)} aria-label="结束日期" />
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="录入人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部录入人</SelectItem>
                    {creators.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as (typeof PAGE_SIZES)[number])}>
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} 条
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <RoleGate roles={ENTRY_EDITORS}>
                  <Button
                    size="sm"
                    className="rounded-full shrink-0"
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
                <Empty text={detail.entries.length === 0 ? "还没有记录" : "这个条件下没有记录"} />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>方向</TableHead>
                        <TableHead>转出</TableHead>
                        <TableHead>转入</TableHead>
                        <TableHead>渠道</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead>用途</TableHead>
                        <TableHead>录入人</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="align-top font-mono text-xs">{e.entryDate}</TableCell>
                          <TableCell>
                            <Badge variant={FINANCE_KIND_VARIANT[e.kind]}>{FINANCE_KIND_LABEL[e.kind]}</Badge>
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            <PartyLink kind={e.fromKind} id={e.fromId} name={e.fromName} />
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            <PartyLink kind={e.toKind} id={e.toId} name={e.toName} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {isOneOf(PAY_CHANNEL, e.channel) ? (
                                <Badge variant={PAY_CHANNEL_VARIANT[e.channel]}>
                                  {PAY_CHANNEL_LABEL[e.channel]}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              e.kind === "income" ? "text-success" : "text-warning"
                            }`}
                          >
                            {e.amount === null ? "···" : fmtLedgerAmount(e.amount, e.currency)}
                          </TableCell>
                          <TableCell className="align-top min-w-[14rem]">
                            <PurposeCell text={e.note} />
                          </TableCell>
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
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeletingEntry(e)}>
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
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                    <span>
                      第 {safePage} / {pageCount} 页
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                        上一页
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safePage >= pageCount}
                        onClick={() => setPage(safePage + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {detail?.project.enableDesks && detail?.desks && (
          <Card className="mb-4">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">台子信息</CardTitle>
                <CardDescription>一个台子可以同时属于多个项目</CardDescription>
              </div>
              <RoleGate roles={[ROLES.ADMIN, ROLES.SALES, ROLES.FINANCE]}>
                <Button size="sm" className="rounded-full" onClick={() => setAttachOpen(true)}>
                  <Plus size={14} />
                  挂入台子
                </Button>
              </RoleGate>
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
                      const kind = (
                        DESK_API_KIND.includes(d.apiKind as DeskApiKind) ? d.apiKind : "none"
                      ) as DeskApiKind;
                      const usage = usageMap[d.id];
                      return (
                        <TableRow key={d.id}>
                          <TableCell>
                            <p className="font-medium">{d.name}</p>
                            {d.baseUrl && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.baseUrl}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.ownerName || d.owner.displayName}</TableCell>
                          <TableCell>
                            <Badge variant={DESK_API_KIND_VARIANT[kind]}>{DESK_API_KIND_LABEL[kind]}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {usage === "loading" ? (
                              <span className="text-muted-foreground">拉取中…</span>
                            ) : usage === "error" ? (
                              <span className="text-destructive">拉取失败</span>
                            ) : usage ? (
                              <span className="text-muted-foreground">
                                {usage.usedUsd == null ? usage.message : `$${usage.usedUsd} · ${usage.message}`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">未拉取</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const ok = await mutate(
                                    () => api.del(`/api/projects/${id}/desks?deskId=${d.id}`),
                                    { success: "已从本项目解绑", error: "解绑失败" },
                                  );
                                  if (ok) reload();
                                }}
                              >
                                解绑
                              </Button>
                            </div>
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

      <AttachDeskDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        projectId={id}
        linkedIds={(detail?.desks ?? []).map((item) => item.id)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deletingDemand !== null}
        onOpenChange={(v) => !v && setDeletingDemand(null)}
        title={`删除需求「${deletingDemand?.productName ?? ""}」？`}
        description="删除后详情页不再显示这条需求。"
        onConfirm={async () => {
          if (!deletingDemand) return;
          const ok = await mutate(() => api.del(`/api/projects/${id}/demands/${deletingDemand.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          setDeletingDemand(null);
          if (ok) reload();
        }}
      />

      <ConfirmDialog
        open={deletingEntry !== null}
        onOpenChange={(v) => !v && setDeletingEntry(null)}
        title="删除这条记录？"
        description="删除后项目利润和供应商明细会一起变化。"
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

function fmtDemandPrice(price: number) {
  const amount = Number.isInteger(price) ? String(price) : price.toFixed(2);
  return `¥${amount}`;
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
  const [productName, setProductName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductName(initial?.productName ?? "");
    setSellPrice(initial?.sellPrice != null ? String(initial.sellPrice) : "");
    setNote(initial?.note ?? "");
  }, [open, initial]);

  async function save() {
    if (!productName.trim()) return toast.warning("请填写货名");
    const price = Number(sellPrice);
    if (!Number.isFinite(price) || price < 0) return toast.warning("卖价非法");

    const payload = { productName: productName.trim(), sellPrice: price, note: note.trim() };

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑需求" : "添加需求"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="货名" required>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="甲方要的货" />
          </Field>
          <Field label="卖价" required>
            <Input type="number" min={0} step="any" className="tabular-nums" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          </Field>
          <Field label="描述">
            <Textarea
              rows={5}
              className="min-h-28 resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="规格、交付要求等说明"
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
  const defaultKind: FinanceKind = role === ROLES.RESOURCE ? "cost" : role === ROLES.SALES ? "income" : "cost";
  const suppliers = useSupplierOptions(open);
  const members = useMemberOptions(open);
  const partners = usePartnerOptions(open);

  const [kind, setKind] = useState<FinanceKind>(defaultKind);
  const [costSource, setCostSource] = useState<CostSource>("self");
  const [supplierId, setSupplierId] = useState("");
  const [fromKind, setFromKind] = useState<PartyKind>("member");
  const [fromId, setFromId] = useState<number | null>(null);
  const [toKind, setToKind] = useState<PartyKind>("partner");
  const [toId, setToId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<FundCurrency>("cny");
  const [channel, setChannel] = useState<PayChannel | "">("");
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
    const nextKind = initial?.kind ?? defaultKind;
    setKind(nextKind);
    setCostSource((initial?.costSource as CostSource) || "self");
    setSupplierId(initial?.supplierId ? String(initial.supplierId) : initial?.supplier ? String(initial.supplier.id) : "");
    setFromKind((initial?.fromKind as PartyKind) || (nextKind === "income" ? "partner" : "member"));
    setFromId(initial?.fromId ?? null);
    setToKind((initial?.toKind as PartyKind) || (nextKind === "income" ? "member" : "partner"));
    setToId(initial?.toId ?? null);
    setCurrency((initial?.currency as FundCurrency) || "cny");
    setChannel((initial?.channel as PayChannel) || "");
    setAmount(initial?.amount != null ? String(initial.amount) : "");
    setEntryDate(initial?.entryDate ?? todayStr());
    setNote(initial?.note ?? "");
  }, [open, initial, defaultKind]);

  async function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return toast.warning("金额非法");
    if (!entryDate) return toast.warning("请选择日期");
    if (!note.trim()) return toast.warning("请填写这笔钱是干啥的");
    if (!fromId) return toast.warning("请选择转出人");
    if (!toId) return toast.warning("请选择转入人");
    if (!channel) return toast.warning("请选择转账渠道");
    if (kind === "cost" && costSource === "supplier" && !supplierId) {
      return toast.warning("请选择供应商");
    }

    const payload = {
      kind,
      amount: amt,
      entryDate,
      note: note.trim(),
      currency,
      channel,
      fromKind,
      fromId,
      toKind,
      toId,
      costSource: kind === "cost" ? costSource : "self",
      supplierId: kind === "cost" && costSource === "supplier" ? Number(supplierId) : null,
    };

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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
          <PartyPicker
            label="转出人"
            kind={fromKind}
            id={fromId}
            members={members}
            partners={partners}
            onChange={(k, id) => {
              setFromKind(k);
              setFromId(id);
            }}
          />
          <PartyPicker
            label="转入人"
            kind={toKind}
            id={toId}
            members={members}
            partners={partners}
            onChange={(k, id) => {
              setToKind(k);
              setToId(id);
            }}
          />
          {kind === "cost" && (
            <>
              <Field label="成本类型">
                <Select value={costSource} onValueChange={(v) => setCostSource(v as CostSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_SOURCE.map((item) => (
                      <SelectItem key={item} value={item}>
                        {COST_SOURCE_LABEL[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {costSource === "supplier" && (
                <Field label="供应商" required>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择供应商" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </>
          )}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="币种" required>
              <Select value={currency} onValueChange={(v) => setCurrency(v as FundCurrency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUND_CURRENCY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {FUND_CURRENCY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="渠道" required>
              <Select value={channel || undefined} onValueChange={(v) => setChannel(v as PayChannel)}>
                <SelectTrigger>
                  <SelectValue placeholder="支付宝 / 微信 / 银行卡" />
                </SelectTrigger>
                <SelectContent>
                  {PAY_CHANNEL.map((c) => (
                    <SelectItem key={c} value={c}>
                      {PAY_CHANNEL_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="这笔钱是干啥的" required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：上游结算 / 甲方回款" />
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

function AttachDeskDialog({
  open,
  onOpenChange,
  projectId,
  linkedIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  linkedIds: number[];
  onSaved: () => void;
}) {
  const [desks, setDesks] = useState<Desk[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    api
      .get<{ items: Desk[] }>("/api/desks")
      .then((res) => setDesks(res.items ?? []))
      .catch(() => setDesks([]));
  }, [open]);

  const available = desks.filter((item) => !linkedIds.includes(item.id));

  async function save() {
    if (!picked.length) return toast.warning("请选择台子");
    setSaving(true);
    try {
      const ok = await mutate(() => api.post(`/api/projects/${projectId}/desks`, { deskIds: picked }), {
        success: "已挂入",
        error: "挂入失败",
      });
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
          <DialogTitle>挂入已有台子</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-2">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">没有可挂入的台子</p>
          ) : (
            available.map((item) => {
              const checked = picked.includes(item.id);
              return (
                <label key={item.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setPicked((prev) => (v === true ? [...prev, item.id] : prev.filter((id) => id !== item.id)))
                    }
                  />
                  <span className="font-medium">{item.name}</span>
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving || !available.length}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            挂入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
