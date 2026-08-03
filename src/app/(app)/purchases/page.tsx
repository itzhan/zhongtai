"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useList } from "@/hooks/use-list";
import { useProjectOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { fmtMoneyShort, todayStr } from "@/lib/format";
import type { Purchase } from "./types";

export default function PurchasesPage() {
  const [projectId, setProjectId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(
    () =>
      `/api/purchases?${new URLSearchParams({
        projectId,
        from,
        to,
      }).toString()}`,
    [projectId, from, to],
  );
  const { items, loading, error, reload } = useList<Purchase>(path);
  const projects = useProjectOptions(true);

  const [editing, setEditing] = useState<Purchase | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const stats = useMemo(() => {
    const amounts = items.map((p) => p.totalAmount ?? 0);
    return {
      total: amounts.reduce((s, a) => s + a, 0),
      count: items.length,
      max: amounts.length ? Math.max(...amounts) : 0,
    };
  }, [items]);

  return (
    <>
      <PageHeader
        title="采购记录"
        subtitle="项目成本流水（与项目详情同源）"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={14} />
            新增成本
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <StatCard
          label="成本总额"
          value={fmtMoneyShort(stats.total)}
          icon={Receipt}
          accent="warning"
          positiveIsGood={false}
        />
        <StatCard label="笔数" value={String(stats.count)} icon={ShoppingCart} accent="primary" />
        <StatCard
          label="最大单笔"
          value={fmtMoneyShort(stats.max)}
          icon={TrendingUp}
          accent="default"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="全部项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部项目</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-40"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="开始日期"
        />
        <span className="text-muted-foreground text-sm">至</span>
        <Input
          type="date"
          className="w-40"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="结束日期"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="这个条件下还没有成本记录"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>录入人</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setViewing(p)}>
                    <TableCell className="font-mono text-xs">{p.purchaseDate}</TableCell>
                    <TableCell className="font-medium">{p.project?.name ?? "-"}</TableCell>
                    <TableCell>
                      <p className="truncate max-w-[320px]">{p.content || p.note || "-"}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.purchaserName || p.purchaser.displayName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {p.totalAmount === null ? (
                        <span className="text-muted-foreground/50">···</span>
                      ) : (
                        fmtMoneyShort(p.totalAmount)
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="更多">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                          >
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleting(p)}
                          >
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <CostDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />

      <Dialog open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>成本详情</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <Info label="项目" value={viewing.project?.name ?? "-"} />
                <Info
                  label="录入人"
                  value={viewing.purchaserName || viewing.purchaser.displayName}
                />
                <Info label="日期" value={viewing.purchaseDate} />
                <Info
                  label="金额"
                  value={
                    viewing.totalAmount === null ? "-" : fmtMoneyShort(viewing.totalAmount)
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">说明</p>
                <p className="whitespace-pre-wrap leading-6">
                  {viewing.detail || viewing.content || "-"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这笔成本记录？"
        description="删除后项目成本会相应减少。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/purchases/${deleting.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          setDeleting(null);
          if (ok) reload();
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium break-words">{value}</p>
    </div>
  );
}

function CostDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Purchase | null;
  onSaved: () => void;
}) {
  const projects = useProjectOptions(open);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setNote(initial?.detail || initial?.content || initial?.note || "");
    setTotalAmount(initial?.totalAmount != null ? String(initial.totalAmount) : "");
    setPurchaseDate(initial?.purchaseDate ?? todayStr());
    setPurchaserName(initial?.purchaserName || initial?.purchaser.displayName || "");
  }, [open, initial]);

  async function save() {
    if (!projectId) return toast.warning("请选择归属项目");
    if (!note.trim()) return toast.warning("请填写花销说明");
    const amt = Number(totalAmount);
    if (!Number.isFinite(amt) || amt < 0) return toast.warning("金额非法");

    const payload = {
      projectId: Number(projectId),
      note: note.trim(),
      content: note.trim(),
      detail: note.trim(),
      totalAmount: amt,
      purchaseDate,
      purchaserName: purchaserName.trim() || undefined,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/purchases/${initial.id}`, payload)
            : api.post("/api/purchases", payload),
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
          <DialogTitle>{initial ? "编辑成本" : "新增成本"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="归属项目" required>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="录入人">
              <Input
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
                placeholder="默认当前用户"
              />
            </Field>
            <Field label="日期" required>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="金额" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="tabular-nums"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </Field>

          <Field label="花销说明" required>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="本次成本用途说明"
            />
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
