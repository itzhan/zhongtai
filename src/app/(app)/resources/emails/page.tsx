"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Loader2, MoreHorizontal, Plus, Settings2, Upload } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import ResourceHistoryDialog from "@/components/ResourceHistoryDialog";
import SecretCell from "@/components/SecretCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebounced } from "@/hooks/use-debounced";
import { useList } from "@/hooks/use-list";
import { useSourceOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import {
  RESOURCE_STATUS,
  RESOURCE_STATUS_LABEL,
  RESOURCE_STATUS_VARIANT,
  type ResourceStatus,
} from "@/lib/enums";
import { ROLES } from "@/lib/rbac";
import ResourceToolbar from "../toolbar";
import type { EmailResource, MailProviderInfo } from "../types";
import InboxSheet from "./inbox-sheet";

const NONE = "none";
const EDITORS = [ROLES.RESOURCE];
interface ResourceBusiness { id: number; name: string; active: boolean }

export default function EmailsPage() {
  const [q, setQ] = useState("");
  const [providerKey, setProviderKey] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () => `/api/emails?${new URLSearchParams({ q: debouncedQ, providerKey, status }).toString()}`,
    [debouncedQ, providerKey, status],
  );
  const { items, loading, error, reload } = useList<EmailResource>(path);
  const { items: businesses } = useList<ResourceBusiness>("/api/resource-businesses");

  const [providers, setProviders] = useState<MailProviderInfo[]>([]);
  const loadProviders = () =>
    api
      .get<{ items: MailProviderInfo[] }>("/api/mail-providers")
      .then((r) => setProviders(r.items))
      .catch(() => setProviders([]));
  useEffect(() => {
    void loadProviders();
  }, []);

  const [editing, setEditing] = useState<EmailResource | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [inboxOf, setInboxOf] = useState<EmailResource | null>(null);
  const [deleting, setDeleting] = useState<EmailResource | null>(null);
  const [history, setHistory] = useState<EmailResource | null>(null);

  const providerLabel = (key: string) => providers.find((p) => p.key === key)?.label ?? key;

  return (
    <>
      <ResourceToolbar
        q={q}
        onQ={setQ}
        placeholder="搜索邮箱地址"
        filters={
          <>
            <Select value={providerKey} onValueChange={setProviderKey}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {RESOURCE_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESOURCE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <RoleGate roles={EDITORS}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="接码插件配置"
              onClick={() => setProviderOpen(true)}
            >
              <Settings2 size={16} />
            </Button>
            <Button variant="secondary" className="rounded-full" onClick={() => setBulkOpen(true)}>
              <Upload size={14} />
              批量导入
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={14} />
              新增邮箱
            </Button>
          </RoleGate>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有邮箱"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>密码</TableHead>
                  <TableHead>接码类型</TableHead>
                  <TableHead>适用业务</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-24" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setHistory(e)}>
                    <TableCell className="font-medium text-sm">{e.address}</TableCell>
                    <TableCell>
                      <SecretCell value={e.password} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{providerLabel(e.providerKey)}</Badge>
                    </TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{e.usage.split(",").filter(Boolean).map((v) => <Badge key={v} variant="outline">{v}</Badge>)}</div></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {e.source?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={RESOURCE_STATUS_VARIANT[e.status]}>
                        {RESOURCE_STATUS_LABEL[e.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Button size="sm" variant="secondary" onClick={() => setInboxOf(e)}>
                        <Inbox size={14} />
                        收件箱
                      </Button>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <RoleGate roles={EDITORS}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="更多">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(e);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleting(e)}
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
          </DataState>
        </CardContent>
      </Card>

      <EmailDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        providers={providers}
        businesses={businesses}
        onSaved={reload}
      />
      <BulkEmailDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        providers={providers}
        businesses={businesses}
        onSaved={reload}
      />
      <ProviderConfigDialog
        open={providerOpen}
        onOpenChange={setProviderOpen}
        providers={providers}
        onSaved={loadProviders}
      />
      <InboxSheet email={inboxOf} onOpenChange={(v) => !v && setInboxOf(null)} />
      <ResourceHistoryDialog kind="email" resource={history} label={history?.address ?? "邮箱"} details={history ? [{ label: "邮箱", value: history.address }, { label: "密码", value: history.password }, { label: "接码类型", value: providerLabel(history.providerKey) }, { label: "适用业务", value: history.usage }, { label: "辅助信息", value: history.recoveryInfo }, { label: "来源", value: history.source?.name }, { label: "备注", value: history.notes }] : []} onOpenChange={(v) => !v && setHistory(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除邮箱「${deleting?.address ?? ""}」？`}
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/emails/${deleting.id}`), {
            success: "已移至回收站",
            error: "删除失败",
          });
          setDeleting(null);
          if (ok) reload();
        }}
      />
    </>
  );
}

function EmailDialog({
  open,
  onOpenChange,
  initial,
  providers,
  businesses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EmailResource | null;
  providers: MailProviderInfo[];
  businesses: ResourceBusiness[];
  onSaved: () => void;
}) {
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [providerKey, setProviderKey] = useState("mock");
  const [recoveryInfo, setRecoveryInfo] = useState("");
  const [usage, setUsage] = useState<string[]>([]);
  const [status, setStatus] = useState<ResourceStatus>("available");
  const [sourceId, setSourceId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setAddress(initial?.address ?? "");
    setPassword(initial?.password ?? "");
    setProviderKey(initial?.providerKey ?? providers[0]?.key ?? "mock");
    setRecoveryInfo(initial?.recoveryInfo ?? "");
    setUsage(initial?.usage.split(",").filter(Boolean) ?? []);
    setStatus(initial?.status ?? "available");
    setSourceId(initial?.sourceId ? String(initial.sourceId) : NONE);
    setNotes(initial?.notes ?? "");
  }, [open, initial, providers]);

  async function save() {
    if (!address.trim()) return toast.warning("请填写邮箱地址");

    const payload = {
      address: address.trim(),
      password,
      providerKey,
      recoveryInfo,
      usage: usage.join(","),
      status,
      sourceId: sourceId === NONE ? null : Number(sourceId),
      notes,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/emails/${initial.id}`, payload)
            : api.post("/api/emails", payload),
        { success: initial ? "已保存" : "已创建", error: "保存失败" },
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
          <DialogTitle>{initial ? "编辑邮箱" : "新增邮箱"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="邮箱地址" required>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="a@example.com"
              />
            </Field>
            <Field label="密码">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="接码类型" hint="决定用哪个插件拉收件箱">
              <Select value={providerKey} onValueChange={setProviderKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="来源">
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="状态">
              <Select value={status} onValueChange={(v) => setStatus(v as ResourceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RESOURCE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="辅助/恢复信息">
            <Input value={recoveryInfo} onChange={(e) => setRecoveryInfo(e.target.value)} />
          </Field>

          <Field label="适用业务" hint="邮箱可同时适用多个业务">
            <div className="flex flex-wrap gap-3 rounded-lg border border-border p-3">
              {businesses.filter((b) => b.active).map((b) => <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={usage.includes(b.name)} onCheckedChange={(checked) => setUsage((current) => checked ? [...current, b.name] : current.filter((v) => v !== b.name))} />{b.name}</label>)}
            </div>
          </Field>

          <Field label="备注">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

/// 每行 `地址----密码`, 也兼容逗号、竖线、制表符、空格分隔。
function parseEmails(text: string) {
  const rows: { address: string; password: string }[] = [];
  const badLines: number[] = [];

  text
    .split("\n")
    .map((l) => l.trim())
    .forEach((line, idx) => {
      if (!line) return;
      const [address, password = ""] = line.split(/----|[|,\t ]+/).map((p) => p.trim());
      if (!address) {
        badLines.push(idx + 1);
        return;
      }
      rows.push({ address, password });
    });

  return { rows, badLines };
}

function BulkEmailDialog({
  open,
  onOpenChange,
  providers,
  businesses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: MailProviderInfo[];
  businesses: ResourceBusiness[];
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [providerKey, setProviderKey] = useState("mock");
  const [sourceId, setSourceId] = useState(NONE);
  const [usage, setUsage] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setText("");
    setProviderKey(providers[0]?.key ?? "mock");
    setUsage([]);
  }, [open, providers]);

  const { rows, badLines } = useMemo(() => parseEmails(text), [text]);

  async function save() {
    if (rows.length === 0) return toast.warning("没有可导入的行");

    setSaving(true);
    try {
      const res = await mutate<{ count: number; skipped: number }>(
        () =>
          api.post("/api/emails", {
            bulk: rows,
            providerKey,
            sourceId: sourceId === NONE ? null : Number(sourceId),
            usage: usage.join(","),
          }),
        { error: "导入失败" },
      );
      if (res) {
        toast.success(
          res.skipped > 0
            ? `已导入 ${res.count} 个，跳过 ${res.skipped} 个重复`
            : `已导入 ${res.count} 个邮箱`,
        );
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入邮箱</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="粘贴内容" hint="每行一个：地址----密码，重复的地址会自动跳过">
            <Textarea
              rows={10}
              className="font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"a@example.com----pass123\nb@example.com----pass456"}
            />
          </Field>

          <p className="text-xs">
            <span className="text-muted-foreground">已解析 </span>
            <span className="font-semibold tabular-nums">{rows.length}</span>
            <span className="text-muted-foreground"> 条</span>
            {badLines.length > 0 && (
              <span className="text-destructive ml-2">
                第 {badLines.join("、")} 行格式有误，将被忽略
              </span>
            )}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="统一接码类型">
              <Select value={providerKey} onValueChange={setProviderKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="统一来源">
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="统一适用业务"><div className="flex flex-wrap gap-3 rounded-lg border border-border p-3">{businesses.filter((b) => b.active).map((b) => <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={usage.includes(b.name)} onCheckedChange={(checked) => setUsage((current) => checked ? [...current, b.name] : current.filter((v) => v !== b.name))} />{b.name}</label>)}</div></Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            导入 {rows.length} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/// 配置表单按 provider 声明的 configFields 自动渲染 —— 加新插件不用改这里。
function ProviderConfigDialog({
  open,
  onOpenChange,
  providers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: MailProviderInfo[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, MailProviderInfo>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(Object.fromEntries(providers.map((p) => [p.key, structuredClone(p)])));
  }, [open, providers]);

  async function saveOne(key: string) {
    const p = draft[key];
    if (!p) return;
    setSaving(key);
    try {
      const ok = await mutate(
        () => api.patch(`/api/mail-providers/${key}`, p),
        { success: "已保存", error: "保存失败" },
      );
      if (ok) onSaved();
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>接码插件配置</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {providers.map((p) => {
            const d = draft[p.key] ?? p;
            return (
              <div key={p.key} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground/60 font-mono">{p.key}</p>
                  </div>
                  <Switch
                    checked={d.enabled}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, [p.key]: { ...d, enabled: v } })
                    }
                  />
                </div>

                {p.configFields.map((f) => (
                  <Field key={f.name} label={f.label}>
                    <Input
                      type={f.secret ? "password" : "text"}
                      placeholder={f.placeholder}
                      value={d.config[f.name] ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [p.key]: { ...d, config: { ...d.config, [f.name]: e.target.value } },
                        })
                      }
                    />
                  </Field>
                ))}

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saving === p.key}
                  onClick={() => saveOne(p.key)}
                >
                  {saving === p.key && <Loader2 className="h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
