"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Factory, Loader2, MoreHorizontal, Plus, Upload, Users } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
import RoleGate from "@/components/RoleGate";
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
import { useProductOptions, useProjectOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { BATCH_STATUS, BATCH_STATUS_LABEL, BATCH_STATUS_VARIANT, type BatchStatus } from "@/lib/enums";
import { todayStr } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import type { ProductionBatch } from "../types";

const EDITORS = [ROLES.PRODUCTION];

export default function BatchesPage() {
  const [projectId, setProjectId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  const path = useMemo(
    () => `/api/batches?${new URLSearchParams({ projectId, from, to, status }).toString()}`,
    [projectId, from, to, status],
  );
  const { items, loading, error, reload } = useList<ProductionBatch>(path);
  const projects = useProjectOptions();

  const [editing, setEditing] = useState<ProductionBatch | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProductionBatch | null>(null);
  const [viewing, setViewing] = useState<ProductionBatch | null>(null);

  const stats = useMemo(() => {
    const qty = items.reduce((s, b) => s + b.quantity, 0);
    const people = new Set(items.map((b) => b.operatorId)).size;
    return { count: items.length, qty, people };
  }, [items]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-44">
            <SelectValue />
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
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem>{BATCH_STATUS.map((value) => <SelectItem key={value} value={value}>{BATCH_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select>
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

        <div className="ml-auto">
          <RoleGate roles={EDITORS}>
            <Button
              className="rounded-full"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={14} />
              登记产出
            </Button>
          </RoleGate>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <StatCard label="批次数" value={String(stats.count)} icon={Boxes} accent="primary" />
        <StatCard
          label="产出总量"
          value={stats.qty.toLocaleString("en-US")}
          icon={Factory}
          accent="success"
        />
        <StatCard label="参与人数" value={String(stats.people)} icon={Users} accent="default" />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="这个时间段还没有产出记录"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead>生产人</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>产出信息</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => setViewing(b)}>
                    <TableCell className="font-mono text-xs">{b.batchDate}</TableCell>
                    <TableCell className="font-medium">{b.product.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {b.quantity.toLocaleString("en-US")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.operator.displayName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {b.project.name}
                    </TableCell>
                    <TableCell><Badge variant={BATCH_STATUS_VARIANT[b.status]}>{BATCH_STATUS_LABEL[b.status]}</Badge></TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate font-mono text-xs text-muted-foreground" title={b.resultData || ""}>
                        {b.resultData ? `${b.resultData.split(/\r?\n/).filter(Boolean).length} 条 · ${b.resultData.replace(/\s+/g, " ")}` : "-"}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]">
                      {b.note || "-"}
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
                                setEditing(b);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleting(b)}
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

      <BatchDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <RecordDetailDialog open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)} title="产出批次详情" fields={viewing ? [{ label: "生产日期", value: viewing.batchDate }, { label: "状态", value: BATCH_STATUS_LABEL[viewing.status] }, { label: "生产人", value: viewing.operator.displayName }, { label: "项目", value: viewing.project.name }, { label: "产品", value: viewing.product.name }, { label: "产出数量", value: viewing.quantity.toLocaleString("en-US") }, { label: "备注", value: viewing.note }, { label: "产出信息", value: <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 font-mono text-xs">{viewing.resultData || "-"}</pre>, wide: true }] : []} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这条产出记录？"
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/batches/${deleting.id}`), {
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

function BatchDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProductionBatch | null;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchDate, setBatchDate] = useState("");
  const [status, setStatus] = useState<BatchStatus>("in_use");
  const [note, setNote] = useState("");
  const [resultData, setResultData] = useState("");
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);
  const products = useProductOptions(open);

  useEffect(() => {
    if (!open) return;
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setProductId(initial?.productId ? String(initial.productId) : "");
    setQuantity(initial?.quantity ? String(initial.quantity) : "");
    setBatchDate(initial?.batchDate ?? todayStr());
    setStatus(initial?.status ?? "in_use");
    setNote(initial?.note ?? "");
    setResultData(initial?.resultData ?? "");
  }, [open, initial]);

  async function save() {
    if (!projectId) return toast.warning("请选择归属项目");
    if (!productId) return toast.warning("请选择产品");
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return toast.warning("产出数量需大于 0");
    if (!resultData.trim()) return toast.warning("请上传或填写本次产出信息");

    const payload = {
      projectId: Number(projectId),
      productId: Number(productId),
      quantity: q,
      batchDate,
      status,
      note,
      resultData,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/batches/${initial.id}`, payload)
            : api.post("/api/batches", payload),
        { success: initial ? "已保存" : "已登记", error: "保存失败" },
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑产出" : "登记产出"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
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
            <Field label="产品" required>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="批次状态" required><Select value={status} onValueChange={(value) => setStatus(value as BatchStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BATCH_STATUS.map((value) => <SelectItem key={value} value={value}>{BATCH_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select></Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="产出数量" required>
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                className="tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="生产日期" required>
              <Input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="备注">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <Field label="产出信息" required hint="支持直接粘贴 SK，或选择 .txt / .csv 文件读取">
            <div className="space-y-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent">
                <Upload size={14} />选择文件
                <input
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setResultData(await file.text());
                    e.target.value = "";
                  }}
                />
              </label>
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={resultData}
                onChange={(e) => setResultData(e.target.value)}
                placeholder={"sk-...\nsk-..."}
              />
              <p className="text-xs text-muted-foreground">已读取 {resultData.split(/\r?\n/).filter((v) => v.trim()).length} 条</p>
            </div>
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
