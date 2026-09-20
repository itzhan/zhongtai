"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Unplug, Wallet, Receipt, TrendingUp, Percent } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useCan } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounced } from "@/hooks/use-debounced";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import {
  COST_MODE_LABEL,
  CUSTOMER_PLATFORM,
  CUSTOMER_PLATFORM_LABEL,
  CUSTOMER_PLATFORM_VARIANT,
  isOneOf,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_VARIANT,
  SELL_MODE_LABEL,
  type CostMode,
  type SellMode,
} from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import CustomerDialog from "../customer-dialog";
import ResourceDialog from "../resource-dialog";
import type { Customer, CustomerResource, CustomerUsage, SiteOption, Sub2UserOption } from "../types";

const PERIODS = [
  { value: "month", label: "本月" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
] as const;

function sellHint(row: CustomerResource) {
  if (row.sellMode === "unit") {
    return row.sellUnitPrice != null ? `¥${fmtMoneyShort(row.sellUnitPrice)} / $1` : "固定单价";
  }
  const zhe = row.discount != null ? Number((row.discount * 10).toFixed(2)) : null;
  const fx = row.fxRate != null ? row.fxRate : null;
  if (zhe == null) return "折扣";
  return fx != null ? `${zhe} 折 · 汇率 ${fx}` : `${zhe} 折`;
}

function costHint(row: CustomerResource) {
  if (row.costMode === "api") {
    return row.costUnitPrice != null ? `¥${fmtMoneyShort(row.costUnitPrice)} / $1` : "API 自动";
  }
  return row.costFixedAmount != null ? `定额 ${fmtMoneyShort(row.costFixedAmount)}` : "固定记账";
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canPrice = useCan()("price");
  const canCost = useCan()("cost");
  const canProfit = useCan()("profit");
  const [item, setItem] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CustomerResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<CustomerResource | null>(null);
  const [period, setPeriod] = useState("month");
  const [usage, setUsage] = useState<CustomerUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState("none");
  const [userId, setUserId] = useState("");
  const [userQ, setUserQ] = useState("");
  const [binding, setBinding] = useState(false);
  const debouncedUserQ = useDebounced(userQ);
  const { items: sites } = useList<SiteOption>("/api/sub2-sites");
  const usersPath = useMemo(
    () => (siteId !== "none" ? `/api/sub2-sites/${siteId}/users?q=${encodeURIComponent(debouncedUserQ)}` : null),
    [siteId, debouncedUserQ],
  );
  const { items: users, loading: usersLoading } = useList<Sub2UserOption>(usersPath);

  const reload = useCallback(
    (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      api
        .get<{ item: Customer }>(`/api/customers/${id}`)
        .then((res) => {
          setItem(res.item);
          setSiteId(res.item.sub2SiteId ? String(res.item.sub2SiteId) : "none");
          setUserId(res.item.sub2UserId ? String(res.item.sub2UserId) : "");
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    [id],
  );

  const loadUsage = useCallback(() => {
    setUsageLoading(true);
    setUsageError(null);
    api
      .get<{ item: CustomerUsage }>(`/api/customers/${id}/usage?period=${period}`)
      .then((res) => setUsage(res.item))
      .catch((e) => setUsageError(e instanceof Error ? e.message : String(e)))
      .finally(() => setUsageLoading(false));
  }, [id, period]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const selectedUser = users.find((u) => String(u.id) === userId);

  async function saveBinding(next: { sub2SiteId: number | null; sub2UserId: number | null; sub2UserName?: string; sub2UserEmail?: string }) {
    setBinding(true);
    try {
      const ok = await mutate(() => api.patch(`/api/customers/${id}`, next), {
        success: next.sub2UserId ? "已绑定" : "已解除绑定",
        error: "绑定失败",
      });
      if (ok) {
        reload(true);
        loadUsage();
      }
    } finally {
      setBinding(false);
    }
  }

  return (
    <>
      <PageHeader
        back="/customers"
        title={item?.name ?? "客户详情"}
        subtitle={
          item
            ? `${item.ownerName || item.owner?.displayName || "-"} · ${PARTNER_STATUS_LABEL[item.status]}`
            : undefined
        }
        actions={
          item ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              编辑资料
            </Button>
          ) : null
        }
      />
      <DataState loading={loading} error={error} empty={!item} onRetry={reload}>
        {item && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <StatCard
                label="消耗 USD"
                value={usageLoading ? "…" : fmtMoneyShort(usage?.usageUsd ?? 0)}
                hint={usage?.bound === false ? usage.message : usage ? `${usage.start} ~ ${usage.end}` : undefined}
                icon={Wallet}
                accent="default"
              />
              {canPrice && (
                <StatCard
                  label="收入"
                  value={usageLoading ? "…" : fmtMoneyShort(usage?.income ?? 0)}
                  icon={TrendingUp}
                  accent="success"
                />
              )}
              {canCost && (
                <StatCard
                  label="成本"
                  value={usageLoading ? "…" : usage?.cost == null ? "-" : fmtMoneyShort(usage.cost)}
                  icon={Receipt}
                  accent="warning"
                  positiveIsGood={false}
                />
              )}
              {canProfit && (
                <StatCard
                  label="利润"
                  value={usageLoading ? "…" : usage?.profit == null ? "-" : fmtMoneyShort(usage.profit)}
                  icon={Percent}
                  accent={(usage?.profit ?? 0) >= 0 ? "primary" : "danger"}
                />
              )}
            </div>

            <div className="mb-4">
              <Tabs value={period} onValueChange={setPeriod}>
                <TabsList>
                  {PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value}>
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {usageError ? <p className="mt-2 text-sm text-destructive">{usageError}</p> : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">绑定 sub2 用户</CardTitle>
                  <CardDescription>用中台的管理员 Key 拉用户，绑定后追踪消耗</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field label="中台">
                    <Select value={siteId} onValueChange={(v) => { setSiteId(v); setUserId(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择中台" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不绑定</SelectItem>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {siteId !== "none" && (
                    <>
                      <Field label="搜索用户">
                        <Input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="邮箱 / 用户名" />
                      </Field>
                      <Field label="用户">
                        <Select value={userId || "none"} onValueChange={(v) => setUserId(v === "none" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder={usersLoading ? "加载中…" : "选择用户"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">请选择用户</SelectItem>
                            {item.sub2UserId && !users.some((u) => u.id === item.sub2UserId) ? (
                              <SelectItem value={String(item.sub2UserId)}>
                                {item.sub2UserName || item.sub2UserEmail || `#${item.sub2UserId}`}
                              </SelectItem>
                            ) : null}
                            {users.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.name || u.username || u.email || `#${u.id}`}
                                {u.email && u.email !== u.name ? ` · ${u.email}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={binding || siteId === "none" || !userId}
                      onClick={() => {
                        const u = selectedUser;
                        void saveBinding({
                          sub2SiteId: Number(siteId),
                          sub2UserId: Number(userId),
                          sub2UserName: u?.name || u?.username || item.sub2UserName,
                          sub2UserEmail: u?.email || item.sub2UserEmail,
                        });
                      }}
                    >
                      {binding && <Loader2 className="h-4 w-4 animate-spin" />}
                      保存绑定
                    </Button>
                    {item.sub2UserId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={binding}
                        onClick={() => {
                          setSiteId("none");
                          setUserId("");
                          void saveBinding({ sub2SiteId: null, sub2UserId: null, sub2UserName: "", sub2UserEmail: "" });
                        }}
                      >
                        <Unplug size={14} />
                        解除绑定
                      </Button>
                    ) : null}
                  </div>
                  {item.sub2Site ? (
                    <p className="text-xs text-muted-foreground">
                      当前：{item.sub2Site.name}
                      {item.sub2UserName || item.sub2UserEmail ? ` / ${item.sub2UserName || item.sub2UserEmail}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">还未绑定。中台在「中台管理」里录入地址和 Key。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">购买的资源</CardTitle>
                      <CardDescription>卖价默认按折扣：消耗 × 汇率 × 折扣</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingResource(null);
                        setResourceOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      添加
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.resources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有资源</p>
                  ) : (
                    <div className="space-y-2">
                      {item.resources.map((row) => (
                        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => {
                              setEditingResource(row);
                              setResourceOpen(true);
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{row.name}</span>
                              {isOneOf(CUSTOMER_PLATFORM, row.platform) ? (
                                <Badge variant={CUSTOMER_PLATFORM_VARIANT[row.platform]}>
                                  {CUSTOMER_PLATFORM_LABEL[row.platform]}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {SELL_MODE_LABEL[(row.sellMode as SellMode) ?? "discount"] ?? row.sellMode}
                              {canPrice ? ` · ${sellHint(row)}` : ""}
                              {canCost ? ` · ${COST_MODE_LABEL[(row.costMode as CostMode) ?? "api"] ?? row.costMode} ${costHint(row)}` : ""}
                            </p>
                          </button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingResource(row)}>
                            删除
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">消耗与利润</CardTitle>
                <CardDescription>
                  {usage?.bound === false
                    ? usage.message
                    : "按资源口径实时计算，不写入项目流水"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>资源</TableHead>
                      <TableHead className="text-right">消耗 USD</TableHead>
                      {canPrice && <TableHead className="text-right">收入</TableHead>}
                      {canCost && <TableHead className="text-right">成本</TableHead>}
                      {canProfit && <TableHead className="text-right">利润</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usage?.resources ?? item.resources.map((r) => ({
                      id: r.id,
                      name: r.name,
                      platform: r.platform,
                      usageUsd: 0,
                      income: 0,
                      cost: null,
                      profit: null,
                    }))).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{row.name}</span>
                            {isOneOf(CUSTOMER_PLATFORM, row.platform) ? (
                              <Badge variant={CUSTOMER_PLATFORM_VARIANT[row.platform]}>
                                {CUSTOMER_PLATFORM_LABEL[row.platform]}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoneyShort(row.usageUsd)}</TableCell>
                        {canPrice && <TableCell className="text-right tabular-nums">{fmtMoneyShort(row.income)}</TableCell>}
                        {canCost && (
                          <TableCell className="text-right tabular-nums">
                            {row.cost == null ? "-" : fmtMoneyShort(row.cost)}
                          </TableCell>
                        )}
                        {canProfit && (
                          <TableCell className="text-right tabular-nums">
                            {row.profit == null ? "-" : fmtMoneyShort(row.profit)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </DataState>

      <CustomerDialog open={editing} onOpenChange={setEditing} initial={item} onSaved={() => reload(true)} />
      {item && (
        <ResourceDialog
          open={resourceOpen}
          onOpenChange={setResourceOpen}
          customerId={item.id}
          initial={editingResource}
          onSaved={() => {
            reload(true);
            loadUsage();
          }}
        />
      )}
      <ConfirmDialog
        open={deletingResource !== null}
        onOpenChange={(v) => !v && setDeletingResource(null)}
        title={`删除资源「${deletingResource?.name ?? ""}」？`}
        onConfirm={async () => {
          if (!deletingResource || !item) return;
          const ok = await mutate(() => api.del(`/api/customers/${item.id}/resources/${deletingResource.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          setDeletingResource(null);
          if (ok) {
            reload(true);
            loadUsage();
          }
        }}
      />
    </>
  );
}
