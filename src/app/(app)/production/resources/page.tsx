"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, CreditCard, Mail, Network } from "lucide-react";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";

type Item = { id:number; kind:"email"|"proxy"|"card"; business:string; amount:number; used:boolean; email?:{address:string;password:string;recoveryInfo:string}|null; proxy?:{host:string;port:number;username:string;password:string;protocol:string;expiresAt:string|null}|null; card?:{cardNo:string;cvv:string;expiry:string}|null };
type Batch = { id:number; allocatedAt:string; note:string; project:{name:string}|null; allocator:{displayName:string}; items:Item[] };
const ICON = { email: Mail, proxy: Network, card: CreditCard };
function label(item: Item) { if (item.email) return `${item.email.address} / ${item.email.password}`; if (item.proxy) return `${item.proxy.protocol}://${item.proxy.host}:${item.proxy.port} / ${item.proxy.username}:${item.proxy.password}`; if (item.card) return `${item.card.cardNo} / ${item.card.expiry} / ${item.card.cvv}`; return "资源已删除"; }

export default function ProductionResourcesPage() {
  const { items, loading, error, reload } = useList<Batch>("/api/production/resources");
  const [batchId, setBatchId] = useState(""); const [selected, setSelected] = useState<number[]>([]); const [viewing, setViewing] = useState<Item | null>(null);
  useEffect(() => { if (!batchId && items[0]) setBatchId(String(items[0].id)); }, [items, batchId]);
  const batch = useMemo(() => items.find((item) => String(item.id) === batchId) ?? null, [items, batchId]);
  async function mark(used: boolean) { const ok = await mutate(() => api.patch("/api/production/resources", { ids: selected, used }), { success: used ? "已标记为已用" : "已标记为未用", error: "标记失败" }); if (ok) { setSelected([]); reload(); } }
  return <>
    <PageHeader title="批次资源" subtitle="查看分配给我的资源并维护使用状态" />
    <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有分配给你的资源" onRetry={reload}>{items.length > 0 && <>
      <div className="mb-4 flex flex-wrap items-center gap-2"><Select value={batchId} onValueChange={(value) => { setBatchId(value); setSelected([]); }}><SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.id} value={String(item.id)}>批次 #{item.id} · {fmtDate(item.allocatedAt)} · {item.project?.name ?? "未指定项目"}</SelectItem>)}</SelectContent></Select><Button variant="secondary" disabled={!selected.length} onClick={() => mark(true)}><CheckCircle2 size={14} />标记已用</Button><Button variant="outline" disabled={!selected.length} onClick={() => mark(false)}><Circle size={14} />标记未用</Button></div>
      {batch && <Card><CardContent className="p-0"><div className="border-b px-4 py-3 text-sm"><span className="font-medium">分配人：{batch.allocator.displayName}</span><span className="ml-4 text-muted-foreground">{batch.note || "无备注"}</span></div><Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={batch.items.length > 0 && selected.length === batch.items.length} onCheckedChange={(value) => setSelected(value ? batch.items.map((item) => item.id) : [])} /></TableHead><TableHead>类型</TableHead><TableHead>资源信息</TableHead><TableHead>业务</TableHead><TableHead>分配值</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{batch.items.map((item) => { const Icon = ICON[item.kind]; return <TableRow key={item.id} className="cursor-pointer" onClick={() => setViewing(item)}><TableCell onClick={(event) => event.stopPropagation()}><Checkbox checked={selected.includes(item.id)} onCheckedChange={(value) => setSelected((current) => value ? [...current, item.id] : current.filter((id) => id !== item.id))} /></TableCell><TableCell><Icon size={15} /></TableCell><TableCell className="font-mono text-xs break-all">{label(item)}</TableCell><TableCell>{item.business || "-"}</TableCell><TableCell>{item.kind === "card" ? item.amount : 1}</TableCell><TableCell><Badge variant={item.used ? "secondary" : "success"}>{item.used ? "已用" : "未用"}</Badge></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>}
    </>}</DataState>
    <RecordDetailDialog open={viewing !== null} onOpenChange={(value) => !value && setViewing(null)} title="分配资源详情" fields={viewing ? [{ label: "类型", value: viewing.kind === "email" ? "邮箱" : viewing.kind === "proxy" ? "代理 IP" : "卡" }, { label: "业务", value: viewing.business }, { label: "状态", value: viewing.used ? "已用" : "未用" }, { label: "分配值", value: viewing.kind === "card" ? viewing.amount : 1 }, { label: "资源信息", value: label(viewing), wide: true }] : []} />
  </>;
}
