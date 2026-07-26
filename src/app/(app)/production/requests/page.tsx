"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  ShoppingCart,
} from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import { useCan } from "@/components/RoleProvider";
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
import { useProjectOptions, useSourceOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_VARIANT,
  RESOURCE_KIND_LABEL,
} from "@/lib/enums";
import { fmtMoneyShort, todayStr } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import type { ResourceRequest } from "../types";
import UsageLines, { newUsageLine, type UsageLine } from "./usage-lines";

const REPORTERS = [ROLES.PRODUCTION];
const HANDLERS = [ROLES.RESOURCE, ROLES.FINANCE];

export default function RequestsPage() {
  const can = useCan();
  const showCost = can("cost");

  const [status, setStatus] = useState("all");
  const [projectId, setProjectId] = useState("all");

  const path = useMemo(
    () => `/api/requests?${new URLSearchParams({ status, projectId }).toString()}`,
    [status, projectId],
  );
  const { items, loading, error, reload } = useList<ResourceRequest>(path);
  const projects = useProjectOptions();

  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<ResourceRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ResourceRequest | null>(null);
  const [purchasing, setPurchasing] = useState<ResourceRequest | null>(null);

  const colSpan = showCost ? 8 : 7;

  async function setStatusOf(r: ResourceRequest, next: string) {
    const ok = await mutate(() => api.patch(`/api/requests/${r.id}/status`, { status: next }), {
      success: "已更新",
      error: "更新失败",
    });
    if (ok) reload();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {REQUEST_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {REQUEST_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

        <div className="ml-auto">
          <RoleGate roles={REPORTERS}>
            <Button
              className="rounded-full"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={14} />
              提交申报
            </Button>
          </RoleGate>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有消耗申报"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>日期</TableHead>
                  <TableHead>申报人</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>资源明细</TableHead>
                  {showCost && <TableHead className="text-right">金额合计</TableHead>}
                  <TableHead>状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const isOpen = expanded === r.id;
                  const total = r.items.reduce((s, i) => s + (i.amount ?? 0), 0);
                  const summary = r.items
                    .map((i) => `${RESOURCE_KIND_LABEL[i.kind]}×${i.quantity}`)
                    .join(" · ");

                  return (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={isOpen ? "收起明细" : "展开明细"}
                            onClick={() => setExpanded(isOpen ? null : r.id)}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.periodDate}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.reporter.displayName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {r.project.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{summary || "无明细"}</Badge>
                        </TableCell>
                        {showCost && (
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtMoneyShort(total)}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={REQUEST_STATUS_VARIANT[r.status]}>
                            {REQUEST_STATUS_LABEL[r.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label="更多">
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <RoleGate roles={HANDLERS}>
                                {r.status !== "purchased" && (
                                  <>
                                    {r.status !== "approved" && (
                                      <DropdownMenuItem
                                        onClick={() => setStatusOf(r, "approved")}
                                      >
                                        标记已确认
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setPurchasing(r)}>
                                      <ShoppingCart size={14} />
                                      生成采购
                                    </DropdownMenuItem>
                                    {r.status !== "rejected" && (
                                      <DropdownMenuItem
                                        onClick={() => setStatusOf(r, "rejected")}
                                      >
                                        驳回
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </RoleGate>
                              <RoleGate roles={REPORTERS}>
                                {r.status === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditing(r);
                                      setOpen(true);
                                    }}
                                  >
                                    编辑
                                  </DropdownMenuItem>
                                )}
                              </RoleGate>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(r)}
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={colSpan} className="p-3">
                            {r.note && (
                              <p className="text-xs text-muted-foreground mb-2">{r.note}</p>
                            )}
                            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                              <div className="grid gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 [grid-template-columns:110px_1fr_80px_100px]">
                                <div>类型</div>
                                <div>来源</div>
                                <div className="text-right">数量</div>
                                {showCost && <div className="text-right">金额</div>}
                              </div>
                              {r.items.map((i) => (
                                <div
                                  key={i.id}
                                  className="grid gap-2 text-sm items-center [grid-template-columns:110px_1fr_80px_100px]"
                                >
                                  <div>{RESOURCE_KIND_LABEL[i.kind]}</div>
                                  <div className="truncate text-muted-foreground">
                                    {i.source?.name ?? "未指定"}
                                  </div>
                                  <div className="text-right tabular-nums">{i.quantity}</div>
                                  {showCost && (
                                    <div className="text-right tabular-nums">
                                      {fmtMoneyShort(i.amount ?? 0)}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {r.purchases.length > 0 && (
                                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                                  已生成 {r.purchases.length} 笔采购记录
                                  {r.handledBy && ` · 处理人 ${r.handledBy.displayName}`}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <RequestDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />

      <ConfirmDialog
        open={purchasing !== null}
        onOpenChange={(v) => !v && setPurchasing(null)}
        title="据此申报生成采购记录？"
        description="会按资源类型各生成一笔采购，并把这张申报标记为「已采购」。"
        confirmText="生成"
        destructive={false}
        onConfirm={async () => {
          if (!purchasing) return;
          const res = await mutate<{ count: number }>(
            () => api.post(`/api/requests/${purchasing.id}/purchase`),
            { error: "生成失败" },
          );
          setPurchasing(null);
          if (res) {
            toast.success(`已生成 ${res.count} 笔采购记录`);
            reload();
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这张申报？"
        description="已生成的采购记录不会被删除。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/requests/${deleting.id}`), {
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

function RequestDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ResourceRequest | null;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [periodDate, setPeriodDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<UsageLine[]>([]);
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);
  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setPeriodDate(initial?.periodDate ?? todayStr());
    setNote(initial?.note ?? "");
    setLines(
      initial
        ? initial.items.map((i) => ({
            key: crypto.randomUUID(),
            kind: i.kind,
            sourceId: i.sourceId,
            quantity: i.quantity,
            // 从整行金额反推单价, 便于继续编辑
            unitPrice: i.quantity > 0 ? (i.amount ?? 0) / i.quantity : 0,
          }))
        : [newUsageLine()],
    );
  }, [open, initial]);

  async function save() {
    if (!projectId) return toast.warning("请选择归属项目");
    if (lines.length === 0) return toast.warning("请至少填写一条消耗明细");

    const bad = lines.findIndex((l) => !Number.isInteger(l.quantity) || l.quantity <= 0);
    if (bad >= 0) return toast.warning(`第 ${bad + 1} 行数量需为正整数`);

    const payload = {
      projectId: Number(projectId),
      periodDate,
      note,
      items: lines.map((l) => ({
        kind: l.kind,
        sourceId: l.sourceId,
        quantity: l.quantity,
        amount: l.quantity * l.unitPrice,
      })),
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/requests/${initial.id}`, payload)
            : api.post("/api/requests", payload),
        { success: initial ? "已保存" : "已提交", error: "保存失败" },
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑申报" : "提交消耗申报"}</DialogTitle>
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
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="消耗日期" required>
              <Input
                type="date"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              消耗明细
            </p>
            <UsageLines value={lines} onChange={setLines} sources={sources} />
            <p className="text-xs text-muted-foreground">
              选来源后会自动带出它配置的参考单价，可以手动改。
            </p>
          </div>

          <Field label="备注">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
