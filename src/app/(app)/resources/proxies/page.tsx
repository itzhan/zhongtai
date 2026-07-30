"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import ResourceHistoryDialog from "@/components/ResourceHistoryDialog";
import SecretCell from "@/components/SecretCell";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PROXY_IP_TYPE,
  PROXY_IP_TYPE_LABEL,
  PROXY_PROTOCOL,
  PROXY_PROTOCOL_LABEL,
  RESOURCE_STATUS,
  RESOURCE_STATUS_LABEL,
  RESOURCE_STATUS_VARIANT,
  type ProxyIpType,
  type ProxyProtocol,
  type ResourceStatus,
} from "@/lib/enums";
import { ROLES } from "@/lib/rbac";
import ResourceToolbar from "../toolbar";
import type { ProxyResource } from "../types";

const NONE = "none";
const EDITORS = [ROLES.RESOURCE];

export default function ProxiesPage() {
  const [q, setQ] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [ipType, setIpType] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () =>
      `/api/proxies?${new URLSearchParams({ q: debouncedQ, protocol, ipType, status }).toString()}`,
    [debouncedQ, protocol, ipType, status],
  );
  const { items, loading, error, reload } = useList<ProxyResource>(path);

  const [editing, setEditing] = useState<ProxyResource | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProxyResource | null>(null);
  const [history, setHistory] = useState<ProxyResource | null>(null);

  return (
    <>
      <ResourceToolbar
        q={q}
        onQ={setQ}
        placeholder="搜索地址或地区"
        filters={
          <>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部协议</SelectItem>
                {PROXY_PROTOCOL.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROXY_PROTOCOL_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ipType} onValueChange={setIpType}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {PROXY_IP_TYPE.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROXY_IP_TYPE_LABEL[t]}
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
              className="rounded-full"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={14} />
              新增代理
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
            emptyText="还没有代理 IP"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>地址</TableHead>
                  <TableHead>协议</TableHead>
                  <TableHead>IP 类型</TableHead>
                  <TableHead>认证</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setHistory(p)}>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {p.host}:{p.port}
                        {p.ipType === "dynamic" && (
                          <RefreshCw
                            size={12}
                            className="text-muted-foreground/60"
                            aria-label="出口 IP 会变化"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{PROXY_PROTOCOL_LABEL[p.protocol]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="purple">{PROXY_IP_TYPE_LABEL[p.ipType]}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.username ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-mono">{p.username}</span>
                          <SecretCell value={p.password} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.region || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.expiresAt ? p.expiresAt.slice(0, 10) : "长期"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.source?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={RESOURCE_STATUS_VARIANT[p.status]}>
                        {RESOURCE_STATUS_LABEL[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                                setEditing(p);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleting(p)}
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

      <ProxyDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <ResourceHistoryDialog kind="proxy" resource={history} label={history ? `${history.host}:${history.port}` : "代理 IP"} details={history ? [{ label: "地址", value: `${history.host}:${history.port}` }, { label: "协议 / 类型", value: `${PROXY_PROTOCOL_LABEL[history.protocol]} / ${PROXY_IP_TYPE_LABEL[history.ipType]}` }, { label: "用户名", value: history.username }, { label: "密码", value: history.password }, { label: "地区", value: history.region }, { label: "有效期", value: history.expiresAt?.slice(0, 10) || "长期" }, { label: "来源", value: history.source?.name }, { label: "备注", value: history.notes }] : []} onOpenChange={(v) => !v && setHistory(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这个代理？"
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/proxies/${deleting.id}`), {
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

function ProxyDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProxyResource | null;
  onSaved: () => void;
}) {
  const [protocol, setProtocol] = useState<ProxyProtocol>("socks");
  const [ipType, setIpType] = useState<ProxyIpType>("static");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [rotateUrl, setRotateUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<ResourceStatus>("available");
  const [sourceId, setSourceId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setProtocol(initial?.protocol ?? "socks");
    setIpType(initial?.ipType ?? "static");
    setHost(initial?.host ?? "");
    setPort(initial?.port ? String(initial.port) : "");
    setUsername(initial?.username ?? "");
    setPassword(initial?.password ?? "");
    setRegion(initial?.region ?? "");
    setRotateUrl(initial?.rotateUrl ?? "");
    setExpiresAt(initial?.expiresAt?.slice(0, 10) ?? "");
    setStatus(initial?.status ?? "available");
    setSourceId(initial?.sourceId ? String(initial.sourceId) : NONE);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  async function save() {
    if (!host.trim()) return toast.warning("请填写地址");
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return toast.warning("端口需为 1-65535");

    const payload = {
      protocol,
      ipType,
      host: host.trim(),
      port: p,
      username,
      password,
      region,
      rotateUrl,
      expiresAt: expiresAt || null,
      status,
      sourceId: sourceId === NONE ? null : Number(sourceId),
      notes,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/proxies/${initial.id}`, payload)
            : api.post("/api/proxies", payload),
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
          <DialogTitle>{initial ? "编辑代理" : "新增代理"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 协议与 IP 类型是两个正交维度: 动态 IP 同样分 socks/http */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="网络类型">
              <Tabs value={protocol} onValueChange={(v) => setProtocol(v as ProxyProtocol)}>
                <TabsList className="w-full">
                  {PROXY_PROTOCOL.map((p) => (
                    <TabsTrigger key={p} value={p} className="flex-1">
                      {PROXY_PROTOCOL_LABEL[p]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </Field>
            <Field label="IP 类型">
              <Tabs value={ipType} onValueChange={(v) => setIpType(v as ProxyIpType)}>
                <TabsList className="w-full">
                  {PROXY_IP_TYPE.map((t) => (
                    <TabsTrigger key={t} value={t} className="flex-1">
                      {PROXY_IP_TYPE_LABEL[t]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="地址" required className="col-span-2">
              <Input
                className="font-mono"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="1.2.3.4"
              />
            </Field>
            <Field label="端口" required>
              <Input
                type="number"
                className="tabular-nums"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="1080"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="用户名">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="密码">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>

          {ipType === "dynamic" && (
            <Field label="换 IP 接口" hint="动态 IP 专用，调用后出口 IP 会变化">
              <Input
                className="font-mono text-xs"
                value={rotateUrl}
                onChange={(e) => setRotateUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>
          )}

          <Field label="有效期" hint="不填表示长期有效">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="地区">
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="US / HK"
              />
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
