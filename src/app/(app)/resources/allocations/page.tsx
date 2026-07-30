"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import RoleGate from "@/components/RoleGate";
import { useRole } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useList } from "@/hooks/use-list";
import { useProjectOptions, useSourceOptions, useUserOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/enums";
import { fmtDate } from "@/lib/format";
import { ROLES } from "@/lib/rbac";

const NONE = "none";
const CREATORS = [ROLES.RESOURCE];
interface ConcreteItem { id?: number; kind: ResourceKind; sourceId: number | null; business: string; emailId?: number | null; proxyId?: number | null; cardId?: number | null; quantity: number; amount: number; label?: string; source?: { id: number; name: string } | string | null; email?: { id: number; address: string } | null; proxy?: { id: number; host: string; port: number } | null; card?: { id: number; cardNo: string } | null }
interface Allocation { id: number; assigneeId: number; projectId: number | null; note: string; allocatedAt: string; assignee: { id: number; displayName: string }; allocator: { id: number; displayName: string }; project: { id: number; code: string; name: string } | null; items: ConcreteItem[] }
interface Business { id: number; name: string; active: boolean }
type Draft = { kind: ResourceKind; sourceId: string; business: string; value: string };
const blankRows = (): Draft[] => ([{ kind: "email", sourceId: NONE, business: "", value: "" }, { kind: "proxy", sourceId: NONE, business: "", value: "" }, { kind: "card", sourceId: NONE, business: "", value: "" }]);

export default function AllocationsPage() {
  const role = useRole();
  const { items, loading, error, reload } = useList<Allocation>("/api/allocations");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Allocation | null>(null);
  const [viewing, setViewing] = useState<Allocation | null>(null);
  const [deleting, setDeleting] = useState<Allocation | null>(null);
  const canEdit = role === ROLES.ADMIN || role === ROLES.RESOURCE;
  return <>
    <div className="flex justify-end mb-4"><RoleGate roles={CREATORS}><Button className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={14} />分配资源</Button></RoleGate></div>
    <Card><CardContent className="p-0"><DataState loading={loading} error={error} empty={items.length === 0} emptyText="还没有资源分配记录" onRetry={reload}>
      <Table><TableHeader><TableRow><TableHead>分配时间</TableHead><TableHead>生产人员</TableHead><TableHead>项目</TableHead><TableHead>资源摘要</TableHead><TableHead>分配人</TableHead><TableHead>备注</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>
        {items.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => setViewing(row)}>
          <TableCell className="font-mono text-xs">{fmtDate(row.allocatedAt)}</TableCell><TableCell className="font-medium">{row.assignee.displayName}</TableCell><TableCell className="text-xs text-muted-foreground">{row.project?.name ?? "-"}</TableCell>
          <TableCell><div className="flex flex-wrap gap-1">{(["email", "proxy", "card"] as ResourceKind[]).map((kind) => { const rows = row.items.filter((v) => v.kind === kind); if (!rows.length) return null; const value = kind === "card" ? `${rows.reduce((s, v) => s + v.amount, 0)} 金额` : `${rows.length} 个`; return <Badge key={kind} variant="outline">{RESOURCE_KIND_LABEL[kind]} {value}</Badge>; })}</div></TableCell>
          <TableCell className="text-xs text-muted-foreground">{row.allocator.displayName}</TableCell><TableCell className="max-w-[220px]"><p className="truncate text-xs text-muted-foreground" title={row.note}>{row.note || "-"}</p></TableCell>
          <TableCell><div className="flex" onClick={(e) => e.stopPropagation()}><Button size="icon-sm" variant="ghost" aria-label="查看" onClick={() => setViewing(row)}><Eye size={14} /></Button>{canEdit && <><Button size="icon-sm" variant="ghost" aria-label="编辑" onClick={() => { setEditing(row); setOpen(true); }}><Pencil size={14} /></Button><Button size="icon-sm" variant="ghost" aria-label="删除" onClick={() => setDeleting(row)}><Trash2 size={14} /></Button></>}</div></TableCell>
        </TableRow>)}
      </TableBody></Table>
    </DataState></CardContent></Card>
    <AllocationDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
    <DetailDialog item={viewing} onOpenChange={(v) => !v && setViewing(null)} />
    <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title="删除这条分配记录？" description="记录将进入回收站，卡的已分配金额会先自动返还，恢复记录时重新扣减。" onConfirm={async () => { if (!deleting) return; const ok = await mutate(() => api.del(`/api/allocations/${deleting.id}`), { success: "已移至回收站", error: "删除失败" }); setDeleting(null); if (ok) reload(); }} />
  </>;
}

function sourceName(item: ConcreteItem) { return typeof item.source === "string" ? item.source : item.source?.name ?? "-"; }
function itemLabel(item: ConcreteItem) { return item.label ?? item.email?.address ?? (item.proxy ? `${item.proxy.host}:${item.proxy.port}` : null) ?? item.card?.cardNo ?? "-"; }
function DetailDialog({ item, onOpenChange }: { item: Allocation | null; onOpenChange: (v: boolean) => void }) {
  return <Dialog open={item !== null} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>分配详情</DialogTitle></DialogHeader>{item && <div className="space-y-4"><div className="grid grid-cols-3 gap-3 text-sm"><Info label="生产人员" value={item.assignee.displayName} /><Info label="归属项目" value={item.project?.name ?? "-"} /><Info label="分配人" value={item.allocator.displayName} /></div><ResourcePreview items={item.items} /><div><p className="text-xs text-muted-foreground mb-1">备注</p><p className="text-sm whitespace-pre-wrap">{item.note || "-"}</p></div></div>}</DialogContent></Dialog>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-1">{value}</p></div>; }
function ResourcePreview({ items }: { items: ConcreteItem[] }) { return <div className="rounded-lg border border-border overflow-hidden"><Table><TableHeader><TableRow><TableHead>类型</TableHead><TableHead>具体资源</TableHead><TableHead>供应商</TableHead><TableHead>业务</TableHead><TableHead className="text-right">分配值</TableHead></TableRow></TableHeader><TableBody>{items.map((v, i) => <TableRow key={`${v.kind}-${v.emailId ?? v.proxyId ?? v.cardId}-${i}`}><TableCell>{RESOURCE_KIND_LABEL[v.kind]}</TableCell><TableCell className="font-mono text-xs">{itemLabel(v)}</TableCell><TableCell className="text-xs">{sourceName(v)}</TableCell><TableCell>{v.business || "-"}</TableCell><TableCell className="text-right">{v.kind === "card" ? `${v.amount} 金额` : "1 个"}</TableCell></TableRow>)}</TableBody></Table></div>; }

function AllocationDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; initial: Allocation | null; onSaved: () => void }) {
  const [assigneeId, setAssigneeId] = useState(""); const [projectId, setProjectId] = useState(NONE); const [note, setNote] = useState(""); const [rows, setRows] = useState<Draft[]>(blankRows()); const [preview, setPreview] = useState<ConcreteItem[]>([]); const [loading, setLoading] = useState(false);
  const users = useUserOptions(ROLES.PRODUCTION, open); const projects = useProjectOptions(open); const sources = useSourceOptions(open); const { items: businesses } = useList<Business>(open ? "/api/resource-businesses" : null);
  useEffect(() => { if (!open) return; setAssigneeId(initial ? String(initial.assigneeId) : ""); setProjectId(initial?.projectId ? String(initial.projectId) : NONE); setNote(initial?.note ?? ""); setPreview([]); if (!initial) return setRows(blankRows()); setRows((["email", "proxy", "card"] as ResourceKind[]).map((kind) => { const values = initial.items.filter((v) => v.kind === kind); return { kind, sourceId: values[0]?.sourceId ? String(values[0].sourceId) : NONE, business: values[0]?.business ?? "", value: kind === "card" ? String(values.reduce((s, v) => s + v.amount, 0) || "") : String(values.length || "") }; })); }, [open, initial]);
  const change = (index: number, patch: Partial<Draft>) => { setRows((current) => current.map((v, i) => i === index ? { ...v, ...patch } : v)); setPreview([]); };
  async function loadPreview() { if (!assigneeId) return toast.warning("请选择生产人员"); const requested = rows.filter((v) => Number(v.value) > 0); if (!requested.length) return toast.warning("请填写要分配的数量或金额"); setLoading(true); try { const res = await mutate<{ items: ConcreteItem[] }>(() => api.post("/api/allocations/preview", { allocationId: initial?.id, rows: requested.map((v) => ({ kind: v.kind, sourceId: v.sourceId === NONE ? null : Number(v.sourceId), business: v.business, ...(v.kind === "card" ? { amount: Number(v.value) } : { quantity: Number(v.value) }) })) }), { error: "预览失败" }); if (res) setPreview(res.items); } finally { setLoading(false); } }
  async function save() { if (!preview.length) return toast.warning("请先预览资源"); setLoading(true); try { const payload = { assigneeId: Number(assigneeId), projectId: projectId === NONE ? null : Number(projectId), note, items: preview }; const ok = await mutate(() => initial ? api.patch(`/api/allocations/${initial.id}`, payload) : api.post("/api/allocations", payload), { success: initial ? "已更新" : "资源已分配", error: "保存失败" }); if (ok) { onOpenChange(false); onSaved(); } } finally { setLoading(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{initial ? "编辑分配记录" : "分配生产资源"}</DialogTitle></DialogHeader>
    <div className="grid sm:grid-cols-2 gap-3"><Field label="生产人员" required><Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); setPreview([]); }}><SelectTrigger><SelectValue placeholder="选择人员" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>)}</SelectContent></Select></Field><Field label="归属项目"><Select value={projectId} onValueChange={(v) => { setProjectId(v); setPreview([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>不指定</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></Field></div>
    <div className="space-y-2">{rows.map((row, index) => <div key={row.kind} className="grid grid-cols-[110px_1fr_1fr_140px] gap-2 items-end"><Field label={index === 0 ? "类型" : ""}><div className="h-9 flex items-center"><Badge variant="outline">{RESOURCE_KIND_LABEL[row.kind]}</Badge></div></Field><Field label={index === 0 ? "供应商" : ""}><Select value={row.sourceId} onValueChange={(v) => change(index, { sourceId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>不指定</SelectItem>{sources.filter((s) => !s.kinds || s.kinds.includes(row.kind)).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></Field><Field label={index === 0 ? "业务用途" : ""}>{row.kind === "proxy" ? <div className="h-9 flex items-center text-sm text-muted-foreground">-</div> : <Select value={row.business} onValueChange={(v) => change(index, { business: v })}><SelectTrigger><SelectValue placeholder="选择业务" /></SelectTrigger><SelectContent>{businesses.filter((b) => b.active).map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select>}</Field><Field label={index === 0 ? (row.kind === "card" ? "金额" : "数量") : ""}><Input type="number" min={0} step={row.kind === "card" ? "0.01" : "1"} value={row.value} onChange={(e) => change(index, { value: e.target.value })} placeholder={row.kind === "card" ? "分配金额" : "分配数量"} /></Field></div>)}</div>
    <Field label="备注"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>{preview.length > 0 && <div><p className="text-sm font-medium mb-2">本次分配预览</p><ResourcePreview items={preview} /></div>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button><Button variant="secondary" onClick={loadPreview} disabled={loading}>{loading && <Loader2 className="animate-spin" />}预览资源</Button><Button onClick={save} disabled={loading || !preview.length}>确认{initial ? "更新" : "分配"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
