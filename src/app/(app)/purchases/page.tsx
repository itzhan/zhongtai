"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
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
import { useList } from "@/hooks/use-list";
import { useProjectOptions, useSourceOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PURCHASE_KIND, PURCHASE_KIND_LABEL, type PurchaseKind } from "@/lib/enums";
import { fmtMoneyShort, todayStr } from "@/lib/format";
import type { Purchase } from "./types";

const NONE = "none";

const KIND_VARIANT: Record<PurchaseKind, "info" | "purple" | "warning" | "secondary"> = {
  email: "info",
  proxy: "purple",
  card: "warning",
  other: "secondary",
};

export default function PurchasesPage() {
  const [projectId, setProjectId] = useState("all");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(
    () => `/api/purchases?${new URLSearchParams({ projectId, kind, from, to }).toString()}`,
    [projectId, kind, from, to],
  );
  const { items, loading, error, reload } = useList<Purchase>(path);
  const projects = useProjectOptions();

  const [editing, setEditing] = useState<Purchase | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Purchase | null>(null);

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
        subtitle="各项目的采购花费"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={14} />
            新增采购
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <StatCard
          label="采购总额"
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部项目</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.code} · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {PURCHASE_KIND.map((k) => (
              <SelectItem key={k} value={k}>
                {PURCHASE_KIND_LABEL[k]}
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
            emptyText="这个条件下还没有采购记录"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>采购内容</TableHead>
                  <TableHead>采购人</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead className="text-right">总金额</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.purchaseDate}</TableCell>
                    <TableCell>
                      <Badge variant={KIND_VARIANT[p.kind]}>{PURCHASE_KIND_LABEL[p.kind]}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{p.content}</p>
                      {p.detail && (
                        <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                          {p.detail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.purchaser.displayName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.project.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.source?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {p.totalAmount === null ? (
                        <span className="text-muted-foreground/50">···</span>
                      ) : (
                        fmtMoneyShort(p.totalAmount)
                      )}
                    </TableCell>
                    <TableCell>
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

      <PurchaseDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这笔采购记录？"
        description="删除后该项目的成本会相应减少。关联的申报单不受影响。"
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

function PurchaseDialog({
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
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<PurchaseKind>("email");
  const [content, setContent] = useState("");
  const [detail, setDetail] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [sourceId, setSourceId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);
  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setKind(initial?.kind ?? "email");
    setContent(initial?.content ?? "");
    setDetail(initial?.detail ?? "");
    setQuantity(initial?.quantity ? String(initial.quantity) : "");
    setTotalAmount(initial?.totalAmount != null ? String(initial.totalAmount) : "");
    setPurchaseDate(initial?.purchaseDate ?? todayStr());
    setSourceId(initial?.sourceId ? String(initial.sourceId) : NONE);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  async function save() {
    if (!projectId) return toast.warning("请选择归属项目");
    if (!content.trim()) return toast.warning("请填写采购内容");
    const amt = Number(totalAmount);
    if (!Number.isFinite(amt) || amt < 0) return toast.warning("总金额非法");

    const payload = {
      projectId: Number(projectId),
      kind,
      content: content.trim(),
      detail,
      quantity: Number(quantity) || 0,
      totalAmount: amt,
      purchaseDate,
      sourceId: sourceId === NONE ? null : Number(sourceId),
      notes,
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
          <DialogTitle>{initial ? "编辑采购" : "新增采购"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="采购类型">
            <Tabs value={kind} onValueChange={(v) => setKind(v as PurchaseKind)}>
              <TabsList className="w-full">
                {PURCHASE_KIND.map((k) => (
                  <TabsTrigger key={k} value={k} className="flex-1">
                    {PURCHASE_KIND_LABEL[k]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="归属项目" required>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="采购日期" required>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="采购内容" required>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="outlook 邮箱 200 个"
            />
          </Field>

          <Field label="花费详情">
            <Textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="单价、优惠、结算方式等"
            />
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="数量">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className="tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="总金额" required>
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
