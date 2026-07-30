"use client";
import { useEffect, useState, type ReactNode } from "react";
import DataState from "./DataState";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { api } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";

interface Row { id: number; business: string; amount: number; allocation: { allocatedAt: string; note: string; assignee: { displayName: string }; allocator: { displayName: string }; project: { name: string } | null } }
export default function ResourceHistoryDialog({ kind, resource, label, details = [], onOpenChange }: { kind: "email" | "proxy" | "card"; resource: { id: number } | null; label: string; details?: { label: string; value: ReactNode }[]; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState<Row[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!resource) return; setLoading(true); setError(null); api.get<{ items: Row[] }>(`/api/resource-history?kind=${kind}&id=${resource.id}`).then((r) => setItems(r.items)).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false)); }, [kind, resource]);
  return <Dialog open={resource !== null} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{label} · 详情</DialogTitle></DialogHeader>{details.length > 0 && <div className="grid gap-3 border-b pb-4 sm:grid-cols-3">{details.map((detail) => <div key={detail.label}><p className="text-xs text-muted-foreground">{detail.label}</p><div className="mt-1 break-all text-sm font-medium">{detail.value || "-"}</div></div>)}</div>}<p className="text-sm font-medium">分配记录</p><DataState loading={loading} error={error} empty={items.length === 0} emptyText="该资源还没有分配记录"><Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>生产人员</TableHead><TableHead>业务</TableHead>{kind === "card" && <TableHead className="text-right">扣减金额</TableHead>}<TableHead>分配人</TableHead><TableHead>备注</TableHead></TableRow></TableHeader><TableBody>{items.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{fmtDate(row.allocation.allocatedAt)}</TableCell><TableCell>{row.allocation.assignee.displayName}</TableCell><TableCell>{row.business || "-"}</TableCell>{kind === "card" && <TableCell className="text-right tabular-nums">{row.amount}</TableCell>}<TableCell>{row.allocation.allocator.displayName}</TableCell><TableCell>{row.allocation.note || "-"}</TableCell></TableRow>)}</TableBody></Table></DataState></DialogContent></Dialog>;
}
