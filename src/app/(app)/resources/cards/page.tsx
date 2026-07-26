"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Upload } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import SecretCell, { maskCardNo } from "@/components/SecretCell";
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
import { useDebounced } from "@/hooks/use-debounced";
import { useList } from "@/hooks/use-list";
import { useSourceOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import {
  RESOURCE_STATUS,
  RESOURCE_STATUS_LABEL,
  RESOURCE_STATUS_VARIANT,
  type ResourceStatus,
} from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import ResourceToolbar from "../toolbar";
import type { CardResource } from "../types";

const NONE = "none";
const EDITORS = [ROLES.RESOURCE];

export default function CardsPage() {
  const can = useCan();
  const showAmount = can("cost");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () => `/api/cards?${new URLSearchParams({ q: debouncedQ, status, sourceId }).toString()}`,
    [debouncedQ, status, sourceId],
  );
  const { items, loading, error, reload } = useList<CardResource>(path);
  const sources = useSourceOptions();

  const [editing, setEditing] = useState<CardResource | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleting, setDeleting] = useState<CardResource | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <ResourceToolbar
        q={q}
        onQ={setQ}
        placeholder="搜索卡号或适用业务"
        filters={
          <>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {RESOURCE_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESOURCE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <RoleGate roles={EDITORS}>
            <Button variant="secondary" className="rounded-full" onClick={() => setBulkOpen(true)}>
              <Upload size={14} />
              批量导入
            </Button>
            <Button className="rounded-full" onClick={openNew}>
              <Plus size={14} />
              新增卡
            </Button>
          </RoleGate>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有卡"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>卡号</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>CVV</TableHead>
                  {showAmount && <TableHead className="text-right">金额</TableHead>}
                  <TableHead>适用业务</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <SecretCell value={c.cardNo} mask={maskCardNo} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.expiry || "-"}</TableCell>
                    <TableCell>
                      <SecretCell value={c.cvv} />
                    </TableCell>
                    {showAmount && (
                      <TableCell className="text-right tabular-nums">
                        {c.amount === null ? (
                          <span className="text-muted-foreground/50">···</span>
                        ) : (
                          fmtMoneyShort(c.amount)
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {c.usage ? (
                        <Badge variant="outline">{c.usage}</Badge>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {c.source?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={RESOURCE_STATUS_VARIANT[c.status]}>
                        {RESOURCE_STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RoleGate roles={EDITORS}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="更多">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(c);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleting(c)}
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

      <CardDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} onSaved={reload} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这张卡？"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/cards/${deleting.id}`), {
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

function CardDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: CardResource | null;
  onSaved: () => void;
}) {
  const [cardNo, setCardNo] = useState("");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [holder, setHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [usage, setUsage] = useState("");
  const [status, setStatus] = useState<ResourceStatus>("available");
  const [sourceId, setSourceId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setCardNo(initial?.cardNo ?? "");
    setCvv(initial?.cvv ?? "");
    setExpiry(initial?.expiry ?? "");
    setHolder(initial?.holder ?? "");
    setAmount(initial?.amount ? String(initial.amount) : "");
    setUsage(initial?.usage ?? "");
    setStatus(initial?.status ?? "available");
    setSourceId(initial?.sourceId ? String(initial.sourceId) : NONE);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  async function save() {
    if (!cardNo.trim()) return toast.warning("请填写卡号");

    const payload = {
      cardNo: cardNo.trim(),
      cvv,
      expiry,
      holder,
      amount: Number(amount) || 0,
      usage,
      status,
      sourceId: sourceId === NONE ? null : Number(sourceId),
      notes,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial ? api.patch(`/api/cards/${initial.id}`, payload) : api.post("/api/cards", payload),
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
          <DialogTitle>{initial ? "编辑卡" : "新增卡"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="卡号" required>
            <Input
              className="font-mono"
              value={cardNo}
              onChange={(e) => setCardNo(e.target.value)}
              placeholder="4111111111111111"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="有效期" hint="MM/YY">
              <Input
                className="font-mono"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="12/27"
              />
            </Field>
            <Field label="CVV">
              <Input className="font-mono" value={cvv} onChange={(e) => setCvv(e.target.value)} />
            </Field>
            <Field label="金额">
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="持卡人">
              <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
            </Field>
            <Field label="适用业务" hint="自由填写">
              <Input
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                placeholder="注册用 / 充值用"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
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
            <Field label="状态">
              <Select value={status} onValueChange={(v) => setStatus(v as ResourceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RESOURCE_STATUS_LABEL[s]}
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

interface ParsedRow {
  cardNo: string;
  expiry: string;
  cvv: string;
  amount: number;
}

/// 粘贴文本 → 结构化行。每行 `卡号|MM/YY|CVV|金额`, 分隔符兼容 | 和逗号。
function parseBulk(text: string): { rows: ParsedRow[]; badLines: number[] } {
  const rows: ParsedRow[] = [];
  const badLines: number[] = [];

  text
    .split("\n")
    .map((l) => l.trim())
    .forEach((line, idx) => {
      if (!line) return;
      const parts = line.split(/[|,\t]/).map((p) => p.trim());
      const [cardNo, expiry = "", cvv = "", amount = "0"] = parts;
      if (!cardNo) {
        badLines.push(idx + 1);
        return;
      }
      rows.push({ cardNo, expiry, cvv, amount: Number(amount) || 0 });
    });

  return { rows, badLines };
}

function BulkImportDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [sourceId, setSourceId] = useState(NONE);
  const [usage, setUsage] = useState("");
  const [saving, setSaving] = useState(false);
  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setText("");
    setUsage("");
  }, [open]);

  const { rows, badLines } = useMemo(() => parseBulk(text), [text]);

  async function save() {
    if (rows.length === 0) return toast.warning("没有可导入的行");

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          api.post("/api/cards", {
            bulk: rows,
            sourceId: sourceId === NONE ? null : Number(sourceId),
            usage,
          }),
        { success: `已导入 ${rows.length} 张卡`, error: "导入失败" },
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
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入卡</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="粘贴内容" hint="每行一张卡：卡号|有效期|CVV|金额，也支持逗号或制表符分隔">
            <Textarea
              rows={10}
              className="font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"4111111111111111|12/27|123|50\n4222222222222222|01/28|456|100"}
            />
          </Field>

          <p className="text-xs">
            <span className="text-muted-foreground">已解析 </span>
            <span className="font-semibold tabular-nums">{rows.length}</span>
            <span className="text-muted-foreground"> 条</span>
            {badLines.length > 0 && (
              <span className="text-destructive ml-2">
                第 {badLines.join("、")} 行缺少卡号，将被忽略
              </span>
            )}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="统一来源">
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
            <Field label="统一适用业务">
              <Input value={usage} onChange={(e) => setUsage(e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            导入 {rows.length} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
