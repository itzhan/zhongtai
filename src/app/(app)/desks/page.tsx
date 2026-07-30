"use client";
import { useMemo, useState } from "react";
import { ExternalLink, MoreHorizontal, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useCan } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList } from "@/hooks/use-list";
import { useDebounced } from "@/hooks/use-debounced";
import { useProjectOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PARTNER_STATUS, PARTNER_STATUS_LABEL, PARTNER_STATUS_VARIANT } from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import DeskDialog from "./desk-dialog";
import type { Desk } from "./types";

export default function DesksPage() {
  const showPrice = useCan()("price");
  const [q, setQ] = useState(""); const [projectId, setProjectId] = useState("all"); const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);
  const path = useMemo(() => `/api/desks?${new URLSearchParams({ q: debouncedQ, projectId, status })}`, [debouncedQ, projectId, status]);
  const { items, loading, error, reload } = useList<Desk>(path); const projects = useProjectOptions();
  const [editing, setEditing] = useState<Desk | null>(null); const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState<Desk | null>(null);
  return <>
    <PageHeader title="台子管理" subtitle="下游台子、访问地址与卖价" actions={<Button className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={14} />新增台子</Button>} />
    <div className="flex flex-wrap gap-2 mb-4"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8 w-56" placeholder="搜索台子名称" value={q} onChange={(e) => setQ(e.target.value)} /></div><Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部项目</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem>{PARTNER_STATUS.map((s) => <SelectItem key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select></div>
    <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有台子" onRetry={reload}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((d) => <Card key={d.id} className="h-full"><CardHeader className="pb-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><CardTitle className="text-base">{d.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{d.project?.name ?? "-"} · {d.owner?.displayName ?? "-"}</p></div><Badge variant={PARTNER_STATUS_VARIANT[d.status]}>{PARTNER_STATUS_LABEL[d.status]}</Badge><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="更多"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setEditing(d); setOpen(true); }}>编辑</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(d)}>删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardHeader><CardContent className="space-y-4">{d.baseUrl ? <a href={d.baseUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate font-mono text-xs text-primary"><ExternalLink size={13} />{d.baseUrl}</a> : <p className="text-xs text-muted-foreground">未填写 Base URL</p>}<p className="min-h-12 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{d.demand || "暂无需求说明"}</p><div className="border-t pt-3 space-y-2">{d.items.length ? d.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{item.productName || item.product.name}</span><span className="shrink-0 font-medium tabular-nums">{showPrice && item.unitPrice !== null ? fmtMoneyShort(item.unitPrice) : "-"}</span></div>) : <p className="text-xs text-muted-foreground">暂无卖价</p>}</div></CardContent></Card>)}</div></DataState>
    <DeskDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
    <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title={`删除台子「${deleting?.name ?? ""}」？`} description="删除后将进入回收站，可随时恢复。" onConfirm={async () => { if (!deleting) return; const ok = await mutate(() => api.del(`/api/desks/${deleting.id}`), { success: "已移至回收站", error: "删除失败" }); setDeleting(null); if (ok) reload(); }} />
  </>;
}
