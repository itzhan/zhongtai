"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import {
  DISPATCH_ACTION,
  DISPATCH_ACTION_LABEL,
  MONITOR_GRADE_LABEL,
  MONITOR_GRADE_VARIANT,
  MONITOR_KIND_LABEL,
  isOneOf,
  type DispatchAction,
  type MonitorGrade,
} from "@/lib/enums";
import { fmtDate } from "@/lib/format";
import type { MonitorScore } from "@/lib/monitor-score";

interface SiteRow {
  id: number;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  enabled: boolean;
  hysteresis: number;
  escalateAfterMin: number;
  loadFactorStep: number;
  maxLoadFactor: number;
  concurrencyStep: number;
  maxConcurrency: number;
  _count?: { monitors: number };
  logs?: { action: string; detail: string; createdAt: string; ok: boolean }[];
}

interface BindingRow {
  id: number;
  name: string;
  kind: string;
  enabled: boolean;
  sub2AccountId: number | null;
  supplier: { id: number; name: string };
  rate: number | null;
  platform: string;
  score: MonitorScore;
  account: {
    id: number;
    name: string;
    status: string;
    schedulable: boolean;
    priority: number;
    concurrency: number;
    current_concurrency: number;
    load_factor: number | null;
  } | null;
}

interface LiveItem {
  site: SiteRow;
  bindings: BindingRow[];
  unbound: { id: number; name: string; platform: string; status: string; schedulable: boolean; priority: number }[];
}

interface LogRow {
  id: number;
  accountId: number;
  action: string;
  grade: string;
  detail: string;
  ok: boolean;
  currentInUse: number | null;
  createdAt: string;
  monitor: { id: number; name: string; supplier: { name: string } } | null;
}

const emptyForm = {
  name: "",
  baseUrl: "",
  apiKey: "",
  hysteresis: "2",
  escalateAfterMin: "3",
  loadFactorStep: "10",
  maxLoadFactor: "100",
  concurrencyStep: "5",
  maxConcurrency: "50",
};

export default function SchedulePage() {
  const { items, loading, error, reload } = useList<SiteRow>("/api/sub2-sites");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [deleting, setDeleting] = useState<SiteRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<SiteRow | null>(null);
  const [live, setLive] = useState<LiveItem | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  function setField<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: SiteRow) {
    setEditing(row);
    setForm({
      name: row.name,
      baseUrl: row.baseUrl,
      apiKey: "",
      hysteresis: String(row.hysteresis),
      escalateAfterMin: String(row.escalateAfterMin),
      loadFactorStep: String(row.loadFactorStep),
      maxLoadFactor: String(row.maxLoadFactor),
      concurrencyStep: String(row.concurrencyStep),
      maxConcurrency: String(row.maxConcurrency),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.warning("请填写台子名称");
    if (!form.baseUrl.trim()) return toast.warning("请填写 sub2 地址");
    if (!editing && !form.apiKey.trim()) return toast.warning("请填写管理员 API Key");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        baseUrl: form.baseUrl,
        hysteresis: Number(form.hysteresis),
        escalateAfterMin: Number(form.escalateAfterMin),
        loadFactorStep: Number(form.loadFactorStep),
        maxLoadFactor: Number(form.maxLoadFactor),
        concurrencyStep: Number(form.concurrencyStep),
        maxConcurrency: Number(form.maxConcurrency),
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      };
      const ok = await mutate(
        () => (editing ? api.patch(`/api/sub2-sites/${editing.id}`, payload) : api.post("/api/sub2-sites", payload)),
        { success: editing ? "已保存" : "已添加", error: "保存失败" },
      );
      if (ok) {
        setOpen(false);
        reload();
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConn() {
    if (!form.baseUrl.trim()) return toast.warning("请填写 sub2 地址");
    if (!form.apiKey.trim() && !editing) return toast.warning("请填写管理员 API Key");
    setTesting(true);
    try {
      const path = editing ? `/api/sub2-sites/${editing.id}/test` : "/api/sub2-sites/ping";
      const r = await api.post<{ item: { accountCount: number } }>(path, {
        baseUrl: form.baseUrl,
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      });
      toast.success(`连通正常，拉到 ${r.item.accountCount} 个账号`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "测连通失败");
    } finally {
      setTesting(false);
    }
  }

  async function toggle(row: SiteRow, enabled: boolean) {
    const ok = await mutate(() => api.patch(`/api/sub2-sites/${row.id}`, { enabled }), {
      success: enabled ? "已开启自动调度" : "已暂停自动调度",
      error: "切换失败",
    });
    if (ok) reload();
  }

  async function loadDetail(row: SiteRow) {
    setDetail(row);
    setLiveLoading(true);
    try {
      const [liveRes, logRes] = await Promise.all([
        api.get<{ item: LiveItem }>(`/api/sub2-sites/${row.id}/live`),
        api.get<{ items: LogRow[] }>(`/api/sub2-sites/${row.id}/logs`),
      ]);
      setLive(liveRes.item);
      setLogs(logRes.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载详情失败");
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    if (!detail) return;
    const timer = setInterval(() => void loadDetail(detail), 60_000);
    return () => clearInterval(timer);
  }, [detail?.id]);

  async function resetConcurrency(monitorId: number) {
    if (!detail) return;
    const ok = await mutate(() => api.post(`/api/sub2-sites/${detail.id}/reset`, { monitorId }), {
      success: "已重置并发",
      error: "重置失败",
    });
    if (ok) loadDetail(detail);
  }

  return (
    <>
      <PageHeader
        title="自动调度"
        subtitle="绑定 sub2 台子和账号后，按渠道评级开关调度，便宜且优秀的优先"
        actions={
          <Button className="rounded-full" onClick={openCreate}>
            <Plus size={14} />
            添加台子
          </Button>
        }
      />

      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有调度台子" onRetry={reload}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>台子</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>绑定</TableHead>
                  <TableHead>最近动作</TableHead>
                  <TableHead>自动调度</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const last = row.logs?.[0];
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{row.baseUrl}</TableCell>
                      <TableCell>{row._count?.monitors ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                        {last ? (
                          <span className={last.ok ? "" : "text-destructive"}>
                            {isOneOf(DISPATCH_ACTION, last.action) ? DISPATCH_ACTION_LABEL[last.action as DispatchAction] : last.action}
                            {" · "}
                            {fmtDate(last.createdAt)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={row.enabled} onCheckedChange={(v) => toggle(row, v)} />
                          <span className="text-xs text-muted-foreground">{row.enabled ? "开" : "关"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => loadDetail(row)}>
                          详情
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          编辑
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(row)}>
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DataState>

      {detail && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{detail.name} · 绑定渠道</CardTitle>
            </CardHeader>
            <CardContent>
              {liveLoading && !live ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : live?.bindings.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>供应商</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead>倍率</TableHead>
                      <TableHead>评级</TableHead>
                      <TableHead>账号</TableHead>
                      <TableHead>调度</TableHead>
                      <TableHead>priority</TableHead>
                      <TableHead>并发</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {live.bindings.map((row) => {
                      const grade = (row.score.grade || "unknown") as MonitorGrade;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{row.supplier.name}</TableCell>
                          <TableCell>
                            <p>{row.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {MONITOR_KIND_LABEL[row.kind as keyof typeof MONITOR_KIND_LABEL] ?? row.kind}
                            </p>
                          </TableCell>
                          <TableCell className="tabular-nums">{row.rate != null ? `${row.rate}×` : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={MONITOR_GRADE_VARIANT[grade]}>{MONITOR_GRADE_LABEL[grade]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.account ? `#${row.account.id} ${row.account.name}` : row.sub2AccountId ? `#${row.sub2AccountId}` : "未绑定"}
                          </TableCell>
                          <TableCell>
                            {row.account ? (
                              <Badge variant={row.account.schedulable ? "success" : "secondary"}>
                                {row.account.schedulable ? "可调度" : "已暂停"}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">{row.account?.priority ?? "-"}</TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {row.account ? `${row.account.current_concurrency} / ${row.account.concurrency}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => resetConcurrency(row.id)} disabled={!row.account}>
                              重置并发
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">还没有渠道绑定这个台子，去延迟监控里选台子和账号。</p>
              )}
              {!!live?.unbound.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  未绑定、不受自动调度控制：
                  {live.unbound
                    .slice(0, 8)
                    .map((a) => `#${a.id} ${a.name}(p${a.priority})`)
                    .join("、")}
                  {live.unbound.length > 8 ? ` 等 ${live.unbound.length} 个` : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">动作日志</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length ? (
                    logs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={row.ok ? "secondary" : "destructive"}>
                            {isOneOf(DISPATCH_ACTION, row.action) ? DISPATCH_ACTION_LABEL[row.action as DispatchAction] : row.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.monitor ? `${row.monitor.supplier.name} / ${row.monitor.name}` : `#${row.accountId}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.detail}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        还没有调度动作
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑台子" : "添加台子"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="名称" required>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="生产 sub2" />
            </Field>
            <Field label="地址" required hint="例如 https://sub2.example.com">
              <Input value={form.baseUrl} onChange={(e) => setField("baseUrl", e.target.value)} placeholder="https://" />
            </Field>
            <Field label="管理员 API Key" required={!editing} hint={editing ? "留空则不修改" : "对应 x-api-key"}>
              <Input type="password" value={form.apiKey} onChange={(e) => setField("apiKey", e.target.value)} autoComplete="off" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="迟滞次数" hint="连续 N 分钟同向才写上游">
                <Input type="number" min={1} value={form.hysteresis} onChange={(e) => setField("hysteresis", e.target.value)} />
              </Field>
              <Field label="加码等待（分钟）">
                <Input type="number" min={1} value={form.escalateAfterMin} onChange={(e) => setField("escalateAfterMin", e.target.value)} />
              </Field>
              <Field label="负载因子步长">
                <Input type="number" min={1} value={form.loadFactorStep} onChange={(e) => setField("loadFactorStep", e.target.value)} />
              </Field>
              <Field label="负载因子上限">
                <Input type="number" min={1} value={form.maxLoadFactor} onChange={(e) => setField("maxLoadFactor", e.target.value)} />
              </Field>
              <Field label="并发步长">
                <Input type="number" min={1} value={form.concurrencyStep} onChange={(e) => setField("concurrencyStep", e.target.value)} />
              </Field>
              <Field label="并发上限">
                <Input type="number" min={1} value={form.maxConcurrency} onChange={(e) => setField("maxConcurrency", e.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={testConn} disabled={testing || saving}>
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              测连通
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除台子「${deleting?.name ?? ""}」？`}
        description="渠道上的绑定会解开，不会删除 sub2 上的账号。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/sub2-sites/${deleting.id}`), { success: "已删除", error: "删除失败" });
          setDeleting(null);
          if (ok) {
            if (detail?.id === deleting.id) {
              setDetail(null);
              setLive(null);
              setLogs([]);
            }
            reload();
          }
        }}
      />
    </>
  );
}
