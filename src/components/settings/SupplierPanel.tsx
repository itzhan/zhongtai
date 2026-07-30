"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, FileText, Loader2, Mail, MoreHorizontal, Network, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import { RESOURCE_KIND, RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/enums";
import type { ResourceSource } from "@/app/(app)/resources/types";
import { useSession } from "@/components/RoleProvider";
import { ROLES } from "@/lib/rbac";

const ICON = { email: Mail, proxy: Network, card: CreditCard } as const;

export default function SupplierPanel() {
  const session = useSession();
  const canEdit = session.role === ROLES.ADMIN || session.role === ROLES.RESOURCE || session.role === ROLES.FINANCE;
  const { items, loading, error, reload } = useList<ResourceSource>("/api/sources");
  const [editing, setEditing] = useState<ResourceSource | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ResourceSource | null>(null);
  const [filter, setFilter] = useState<"all" | ResourceKind>("all");
  const visibleItems = items.filter((item) => filter === "all" || !item.kinds || item.kinds.split(",").includes(filter));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex h-9 items-center rounded-md border border-border bg-muted/40 p-1">
          <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} className="h-7" onClick={() => setFilter("all")}>全部</Button>
          {RESOURCE_KIND.map((kind) => <Button key={kind} size="sm" variant={filter === kind ? "secondary" : "ghost"} className="h-7" onClick={() => setFilter(kind)}>{RESOURCE_KIND_LABEL[kind]}</Button>)}
        </div>
        {canEdit && <Button className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={14} />新增供应商</Button>}
      </div>
      <DataState loading={loading} error={error} empty={visibleItems.length === 0} emptyText={items.length ? "没有符合该类型的供应商" : "还没有供应商渠道"} onRetry={reload}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const kinds = item.kinds.split(",").filter((k): k is ResourceKind => (RESOURCE_KIND as readonly string[]).includes(k));
            return (
              <Card key={item.id} className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{item.name}</CardTitle>
                    </div>
                    <Badge variant={item.active ? "success" : "secondary"}>{item.active ? "合作中" : "已停用"}</Badge>
                    {canEdit && <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="更多"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(item); setOpen(true); }}>编辑</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(item)}>删除</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(kinds.length ? kinds : RESOURCE_KIND).map((kind) => {
                      const Icon = ICON[kind];
                      return <Badge key={kind} variant="outline"><Icon size={12} />{RESOURCE_KIND_LABEL[kind]}</Badge>;
                    })}
                  </div>
                  <div className="border-l-2 border-primary/60 bg-muted/35 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground"><FileText size={14} className="text-primary" />渠道介绍</div>
                    <p className="min-h-12 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.notes || "暂无渠道介绍"}</p>
                  </div>
                  <div className="flex justify-end text-xs text-muted-foreground">
                    <span className="shrink-0">{item._count.cards} 卡 · {item._count.proxies} IP · {item._count.emails} 邮箱</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DataState>
      <SupplierDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title={`删除供应商「${deleting?.name ?? ""}」？`} description="已关联资源的供应商暂不能移入回收站，可改为停用。" onConfirm={async () => {
        if (!deleting) return;
        const ok = await mutate(() => api.del(`/api/sources/${deleting.id}`), { success: "已移至回收站", error: "删除失败" });
        setDeleting(null); if (ok) reload();
      }} />
    </>
  );
}

function SupplierDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; initial: ResourceSource | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<ResourceKind[]>([]);
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setKinds((initial?.kinds.split(",") ?? []).filter((k): k is ResourceKind => (RESOURCE_KIND as readonly string[]).includes(k)));
    setNotes(initial?.notes ?? ""); setActive(initial?.active ?? true);
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写供应商名称");
    const payload = { name: name.trim(), kinds, notes, active };
    setSaving(true);
    try {
      const ok = await mutate(() => initial ? api.patch(`/api/sources/${initial.id}`, payload) : api.post("/api/sources", payload), { success: initial ? "已保存" : "已创建", error: "保存失败" });
      if (ok) { onOpenChange(false); onSaved(); }
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "编辑供应商" : "新增供应商"}</DialogTitle></DialogHeader>
        <Field label="供应商名称" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="可提供资源"><div className="flex gap-4 rounded-lg border border-border p-3">{RESOURCE_KIND.map((kind) => <label key={kind} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={kinds.includes(kind)} onCheckedChange={(checked) => setKinds((current) => checked ? [...current, kind] : current.filter((v) => v !== kind))} />{RESOURCE_KIND_LABEL[kind]}</label>)}</div></Field>
        <Field label="渠道介绍" required><Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="介绍该供应商的渠道、特点和可提供的资源" /></Field>
        <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">启用供应商</p><p className="text-xs text-muted-foreground">停用后保留历史记录</p></div><Switch checked={active} onCheckedChange={setActive} /></div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
