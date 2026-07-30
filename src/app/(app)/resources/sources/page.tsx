"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import { useCan } from "@/components/RoleProvider";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api, mutate } from "@/lib/api-client";
import { RESOURCE_KIND, RESOURCE_KIND_LABEL, type ResourceKind } from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import ResourceToolbar from "../toolbar";
import type { ResourceSource } from "../types";

export default function SourcesPage() {
  const can = useCan();
  const showCost = can("cost");

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () => `/api/sources?${new URLSearchParams({ q: debouncedQ, kind }).toString()}`,
    [debouncedQ, kind],
  );
  const { items, loading, error, reload } = useList<ResourceSource>(path);

  const [editing, setEditing] = useState<ResourceSource | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ResourceSource | null>(null);
  const [viewing, setViewing] = useState<ResourceSource | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <ResourceToolbar
        q={q}
        onQ={setQ}
        placeholder="搜索名称或渠道"
        filters={
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {RESOURCE_KIND.map((k) => (
                <SelectItem key={k} value={k}>
                  {RESOURCE_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        actions={
          <Button className="rounded-full" onClick={openNew}>
            <Plus size={14} />
            新增来源
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有来源，先把邮箱/卡/IP 是从哪来的登记进来"
            onRetry={reload}
            emptyAction={
              <Button size="sm" variant="secondary" onClick={openNew}>
                <Plus size={14} />
                新增来源
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>来源</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>覆盖类型</TableHead>
                  {showCost && <TableHead>参考单价</TableHead>}
                  <TableHead className="text-right">关联资源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const kinds = s.kinds ? s.kinds.split(",").filter(Boolean) : [];
                  const total = s._count.cards + s._count.proxies + s._count.emails;
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setViewing(s)}>
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        {s.contact && <p className="text-xs text-muted-foreground">{s.contact}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs truncate max-w-[160px]">
                        {s.channel || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {kinds.length === 0 ? (
                            <Badge variant="outline">通用</Badge>
                          ) : (
                            kinds.map((k) => (
                              <Badge key={k} variant="info">
                                {RESOURCE_KIND_LABEL[k as ResourceKind] ?? k}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      {showCost && (
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {[
                            s.emailPrice ? `邮 ${fmtMoneyShort(s.emailPrice)}` : null,
                            s.proxyPrice ? `IP ${fmtMoneyShort(s.proxyPrice)}` : null,
                            s.cardPrice ? `卡 ${fmtMoneyShort(s.cardPrice)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">
                        {total || <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.active ? "success" : "secondary"}>
                          {s.active ? "启用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="更多">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(s);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleting(s)}
                            >
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <SourceDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <RecordDetailDialog open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)} title="资源来源详情" fields={viewing ? [{ label: "名称", value: viewing.name }, { label: "状态", value: viewing.active ? "启用" : "停用" }, { label: "渠道", value: viewing.channel }, { label: "联系方式", value: viewing.contact }, { label: "覆盖类型", value: viewing.kinds.split(",").filter(Boolean).map((kind) => RESOURCE_KIND_LABEL[kind as ResourceKind]).join("、") || "通用" }, { label: "关联资源", value: `${viewing._count.emails} 邮箱 / ${viewing._count.proxies} IP / ${viewing._count.cards} 卡` }, ...(showCost ? [{ label: "参考单价", value: `邮箱 ${fmtMoneyShort(viewing.emailPrice ?? 0)} / IP ${fmtMoneyShort(viewing.proxyPrice ?? 0)} / 卡 ${fmtMoneyShort(viewing.cardPrice ?? 0)}` }, { label: "价格说明", value: viewing.priceInfo }] : []), { label: "渠道介绍", value: viewing.notes, wide: true }] : []} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除来源「${deleting?.name ?? ""}」？`}
        description="已关联资源的来源暂不能移入回收站，可改为「停用」。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/sources/${deleting.id}`), {
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

function SourceDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ResourceSource | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [contact, setContact] = useState("");
  const [kinds, setKinds] = useState<ResourceKind[]>([]);
  const [prices, setPrices] = useState<Record<ResourceKind, string>>({
    email: "",
    proxy: "",
    card: "",
  });
  const [priceInfo, setPriceInfo] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setChannel(initial?.channel ?? "");
    setContact(initial?.contact ?? "");
    setKinds(
      (initial?.kinds ? initial.kinds.split(",") : []).filter((k): k is ResourceKind =>
        (RESOURCE_KIND as readonly string[]).includes(k),
      ),
    );
    setPrices({
      email: initial?.emailPrice ? String(initial.emailPrice) : "",
      proxy: initial?.proxyPrice ? String(initial.proxyPrice) : "",
      card: initial?.cardPrice ? String(initial.cardPrice) : "",
    });
    setPriceInfo(initial?.priceInfo ?? "");
    setActive(initial?.active ?? true);
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写来源名称");

    const payload = {
      name: name.trim(),
      channel,
      contact,
      kinds,
      emailPrice: Number(prices.email) || 0,
      proxyPrice: Number(prices.proxy) || 0,
      cardPrice: Number(prices.card) || 0,
      priceInfo,
      active,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/sources/${initial.id}`, payload)
            : api.post("/api/sources", payload),
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

  const toggleKind = (k: ResourceKind) =>
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑来源" : "新增来源"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="来源名称" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="商家 / 供应者"
              />
            </Field>
            <Field label="渠道">
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="TG 群 / 网站"
              />
            </Field>
          </div>

          <Field label="联系方式">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>

          <Field label="覆盖类型" hint="勾选后可填该类资源的参考单价，申报和采购会用它作默认值">
            <div className="flex flex-wrap gap-4 pt-1">
              {RESOURCE_KIND.map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={kinds.includes(k)} onCheckedChange={() => toggleKind(k)} />
                  <span className="text-sm">{RESOURCE_KIND_LABEL[k]}</span>
                </label>
              ))}
            </div>
          </Field>

          {kinds.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {kinds.map((k) => (
                <div key={k} className="space-y-2">
                  <Label>{RESOURCE_KIND_LABEL[k]}单价</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={prices[k]}
                    onChange={(e) => setPrices({ ...prices, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <Field label="价格情况说明">
            <Textarea
              rows={2}
              value={priceInfo}
              onChange={(e) => setPriceInfo(e.target.value)}
              placeholder="阶梯价、结算方式等"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
            <span className="text-sm">启用</span>
          </label>
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
