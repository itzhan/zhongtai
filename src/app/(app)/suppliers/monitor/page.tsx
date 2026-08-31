"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Loader2, Plus, RefreshCw } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useList } from "@/hooks/use-list";
import { useSupplierOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import {
  goodsKeywordVariant,
  isOneOf,
  MONITOR_DEFAULT_MODEL,
  MONITOR_GRADE,
  MONITOR_GRADE_LABEL,
  MONITOR_GRADE_VARIANT,
  MONITOR_KIND,
  MONITOR_KIND_LABEL,
  MONITOR_KIND_PATH,
  MONITOR_KIND_VARIANT,
  MONITOR_STATUS,
  MONITOR_STATUS_LABEL,
  MONITOR_STATUS_VARIANT,
  monitorPlatform,
  type MonitorGrade,
  type MonitorKind,
  type MonitorStatus,
} from "@/lib/enums";
import { fmtDate } from "@/lib/format";
import { goodsForKind } from "@/lib/monitor-goods";
import { scoreMonitor, type MonitorScore } from "@/lib/monitor-score";

interface Sample {
  id: number;
  status: MonitorStatus | string;
  latencyMs: number;
  error: string;
  checkedAt: string;
}

interface MonitorRow {
  id: number;
  name: string;
  kind: MonitorKind | string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  slowMs: number;
  sub2ChannelId: number | null;
  sub2SiteId: number | null;
  sub2AccountId: number | null;
  sub2Site: { id: number; name: string; enabled: boolean } | null;
  lastStatus: MonitorStatus | string;
  lastLatencyMs: number | null;
  lastError: string;
  lastCheckedAt: string | null;
  supplier: {
    id: number;
    name: string;
    goodsItems?: { id: number; name: string; rate: string }[];
  };
  samples: Sample[];
  score?: MonitorScore;
}

const HEAT_CLASS: Record<string, string> = {
  up: "bg-success",
  slow: "bg-warning",
  down: "bg-destructive",
  limited: "bg-info",
  unknown: "bg-muted",
};

function asStatus(v: string): MonitorStatus {
  return isOneOf(MONITOR_STATUS, v) ? v : "unknown";
}

function asKind(v: string): MonitorKind {
  return isOneOf(MONITOR_KIND, v) ? v : "openai";
}

function asGrade(v: string): MonitorGrade {
  return isOneOf(MONITOR_GRADE, v) ? v : "unknown";
}

function rowScore(row: MonitorRow): MonitorScore {
  return row.score ?? scoreMonitor(row.samples);
}

function Heatmap({ samples }: { samples: Sample[] }) {
  const cells = [...Array(Math.max(0, 24 - samples.length)).fill(null), ...samples.slice(-24)] as Array<Sample | null>;
  return (
    <div className="flex items-center gap-0.5">
      {cells.map((sample, i) => {
        const status = sample ? asStatus(sample.status) : "unknown";
        const block = <div className={`h-6 w-1.5 rounded-sm ${HEAT_CLASS[status] ?? HEAT_CLASS.unknown}`} />;
        if (!sample) return <div key={`empty-${i}`}>{block}</div>;
        return (
          <Tooltip key={sample.id}>
            <TooltipTrigger asChild>
              <div>{block}</div>
            </TooltipTrigger>
            <TooltipContent>
              {fmtDate(sample.checkedAt)} · {MONITOR_STATUS_LABEL[status]}
              {sample.latencyMs ? ` · ${sample.latencyMs}ms` : ""}
              {sample.error ? ` · ${sample.error}` : ""}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface SiteOption {
  id: number;
  name: string;
}
interface AccountOption {
  id: number;
  name: string;
  platform: string;
  status: string;
  schedulable: boolean;
  priority: number;
  concurrency: number;
}

export default function SupplierMonitorPage() {
  const { items, loading, error, reload, setItems } = useList<MonitorRow>("/api/monitors");
  const { items: sites } = useList<SiteOption>("/api/sub2-sites");
  const suppliers = useSupplierOptions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MonitorRow | null>(null);
  const [deleting, setDeleting] = useState<MonitorRow | null>(null);
  const [probing, setProbing] = useState<number | "all" | null>(null);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [name, setName] = useState("默认");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [kind, setKind] = useState<MonitorKind>("openai");
  const [model, setModel] = useState(MONITOR_DEFAULT_MODEL.openai);
  const [slowMs, setSlowMs] = useState("5000");
  const [sub2SiteId, setSub2SiteId] = useState("none");
  const [sub2AccountId, setSub2AccountId] = useState("none");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      void api
        .get<{ items: MonitorRow[] }>("/api/monitors")
        .then((r) => setItems(r.items ?? []))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [setItems]);

  useEffect(() => {
    if (sub2SiteId === "none") {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    setAccountsLoading(true);
    api
      .get<{ items: AccountOption[] }>(`/api/sub2-sites/${sub2SiteId}/accounts?platform=${monitorPlatform(kind)}`)
      .then((r) => {
        if (!cancelled) setAccounts(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sub2SiteId, kind]);

  const stats = useMemo(() => {
    const count = (grade: MonitorGrade) => items.filter((item) => asGrade(rowScore(item).grade) === grade).length;
    return {
      excellent: count("excellent"),
      unstable: count("unstable"),
      unavailable: count("unavailable"),
      unknown: count("unknown"),
    };
  }, [items]);

  function openCreate() {
    setEditing(null);
    setSupplierId(suppliers[0] ? String(suppliers[0].id) : "");
    setName("默认");
    setBaseUrl("");
    setApiKey("");
    setKind("openai");
    setModel(MONITOR_DEFAULT_MODEL.openai);
    setSlowMs("5000");
    setSub2SiteId("none");
    setSub2AccountId("none");
    setOpen(true);
  }

  function openEdit(row: MonitorRow) {
    const nextKind = asKind(row.kind);
    setEditing(row);
    setSupplierId(String(row.supplier.id));
    setName(row.name);
    setBaseUrl(row.baseUrl);
    setApiKey("");
    setKind(nextKind);
    setModel(row.model || MONITOR_DEFAULT_MODEL[nextKind]);
    setSlowMs(String(row.slowMs));
    setSub2SiteId(row.sub2SiteId ? String(row.sub2SiteId) : "none");
    setSub2AccountId(row.sub2AccountId ? String(row.sub2AccountId) : "none");
    setOpen(true);
  }

  function changeKind(next: MonitorKind) {
    setKind(next);
    setModel((current) => {
      const trimmed = current.trim();
      if (!trimmed || (MONITOR_KIND as readonly string[]).some((k) => MONITOR_DEFAULT_MODEL[k as MonitorKind] === trimmed)) {
        return MONITOR_DEFAULT_MODEL[next];
      }
      return current;
    });
  }

  async function save() {
    if (!supplierId) return toast.warning("请选择供应商");
    if (!baseUrl.trim()) return toast.warning("请填写探测地址");
    if (sub2SiteId !== "none" && sub2AccountId === "none") return toast.warning("请选择要绑定的账号");
    setSaving(true);
    try {
      const payload = {
        supplierId: Number(supplierId),
        name,
        kind,
        baseUrl,
        model,
        slowMs: Number(slowMs),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        sub2SiteId: sub2SiteId === "none" ? null : Number(sub2SiteId),
        sub2AccountId: sub2AccountId === "none" ? null : Number(sub2AccountId),
      };
      const ok = await mutate(
        () => (editing ? api.patch(`/api/monitors/${editing.id}`, payload) : api.post("/api/monitors", payload)),
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

  async function probeOne(id: number) {
    setProbing(id);
    try {
      const ok = await mutate(() => api.post(`/api/monitors/${id}/probe`), { success: "探测完成", error: "探测失败" });
      if (ok) reload();
    } finally {
      setProbing(null);
    }
  }

  async function probeAll() {
    setProbing("all");
    try {
      const ok = await mutate(() => api.post("/api/monitors/probe"), { success: "已探测全部启用渠道", error: "探测失败" });
      if (ok) reload();
    } finally {
      setProbing(null);
    }
  }

  async function toggle(row: MonitorRow, enabled: boolean) {
    const ok = await mutate(
      () => api.patch(`/api/monitors/${row.id}`, { enabled }),
      {
        success: enabled ? "已开启探测" : "已暂停探测",
        error: "切换失败",
      },
    );
    if (ok) reload();
  }

  return (
    <TooltipProvider>
      <PageHeader
        title="延迟监控"
        subtitle="启用中的渠道每分钟自动探测；评级看近 12 次（优秀 / 不稳定 / 不可用）"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={probeAll} disabled={probing !== null || !items.length}>
              {probing === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={14} />}
              全部探测
            </Button>
            <Button className="rounded-full" onClick={openCreate}>
              <Plus size={14} />
              添加监测
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <StatCard label="优秀" value={String(stats.excellent)} accent="success" icon={Activity} />
        <StatCard label="不稳定" value={String(stats.unstable)} accent="warning" icon={Activity} />
        <StatCard label="不可用" value={String(stats.unavailable)} accent="danger" icon={Activity} />
        <StatCard label="未评级" value={String(stats.unknown)} icon={Activity} />
      </div>

      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有监测项，先给供应商加上探测地址" onRetry={reload}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>绑定</TableHead>
                  <TableHead>倍率</TableHead>
                  <TableHead>评级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>延迟</TableHead>
                  <TableHead>近 24 次</TableHead>
                  <TableHead>探测</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const status = asStatus(row.lastStatus);
                  const score = rowScore(row);
                  const grade = asGrade(score.grade);
                  const rates = goodsForKind(asKind(row.kind), row.supplier.goodsItems ?? []);
                  return (
                    <TableRow key={row.id} className={!row.enabled ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{row.supplier.name}</TableCell>
                      <TableCell>
                        <Badge variant={MONITOR_KIND_VARIANT[asKind(row.kind)]}>
                          {MONITOR_KIND_LABEL[asKind(row.kind)]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p>{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground max-w-[220px]">{row.model || row.baseUrl}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.sub2Site && row.sub2AccountId ? (
                          <span>
                            {row.sub2Site.name}
                            <span className="text-muted-foreground"> #{row.sub2AccountId}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rates.length ? (
                          <div className="flex flex-wrap gap-1">
                            {rates.map((good) => (
                              <Badge key={good.id} variant={goodsKeywordVariant(good.name)} className="tabular-nums">
                                {good.rate}×
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={MONITOR_GRADE_VARIANT[grade]}>{MONITOR_GRADE_LABEL[grade]}</Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {score.total
                              ? `近 ${score.total} 次：${score.up} 正常 / ${score.slow} 偏慢 / ${score.down} 异常`
                              : "还没有探测记录"}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant={MONITOR_STATUS_VARIANT[status]}>{MONITOR_STATUS_LABEL[status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {row.lastLatencyMs != null ? `${row.lastLatencyMs}ms` : "-"}
                      </TableCell>
                      <TableCell>
                        <Heatmap samples={row.samples} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={row.enabled} onCheckedChange={(v) => toggle(row, v)} />
                          <span className="text-xs text-muted-foreground">{row.enabled ? "开" : "关"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => probeOne(row.id)} disabled={probing !== null || !row.enabled}>
                          {probing === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "探测"}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑监测" : "添加监测"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="供应商" required>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={Boolean(editing)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="探测格式" required hint="Completions → /v1/chat/completions，Responses → /v1/responses，Claude → /v1/messages">
              <Select value={kind} onValueChange={(value) => changeKind(value as MonitorKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONITOR_KIND.map((value) => (
                    <SelectItem key={value} value={value}>
                      {MONITOR_KIND_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="渠道名" hint="同一供应商可监测多条渠道">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="官key / AWS" />
            </Field>
            <Field label="调度台子" hint="绑定后按评级开关该台子上的账号调度">
              <Select
                value={sub2SiteId}
                onValueChange={(value) => {
                  setSub2SiteId(value);
                  setSub2AccountId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不绑定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={String(site.id)}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {sub2SiteId !== "none" && (
              <Field label="sub2 账号" required hint={accountsLoading ? "正在拉取账号…" : "只列出与探测格式对应的平台"}>
                <Select value={sub2AccountId} onValueChange={setSub2AccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择账号" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不绑定</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        #{acc.id} {acc.name} · p{acc.priority} · {acc.schedulable ? "可调度" : "暂停"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="探测地址" required hint={`${kind === "claude" ? "Claude / Anthropic" : "OpenAI"} 兼容 base URL，实际请求 ${MONITOR_KIND_PATH[kind]}`}>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
            </Field>
            <Field label="API Key" hint={editing ? "留空则不修改" : undefined}>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." autoComplete="off" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="检测模型" hint={`默认 ${MONITOR_DEFAULT_MODEL[kind]}`}>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={MONITOR_DEFAULT_MODEL[kind]} />
              </Field>
              <Field label="偏慢阈值" hint="成功但超过该毫秒数记为偏慢，默认 5000">
                <Input type="number" min={200} value={slowMs} onChange={(e) => setSlowMs(e.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter>
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
        title={`删除监测「${deleting?.supplier.name ?? ""} / ${deleting?.name ?? ""}」？`}
        description="历史探测记录会一并删除。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/monitors/${deleting.id}`), { success: "已删除", error: "删除失败" });
          setDeleting(null);
          if (ok) reload();
        }}
      />
    </TooltipProvider>
  );
}
