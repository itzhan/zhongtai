"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Settings2, Trash2, Upload } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import ResourceHistoryDialog from "@/components/ResourceHistoryDialog";
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
  CARD_STATUS,
  CARD_STATUS_LABEL,
  CARD_STATUS_VARIANT,
  type CardStatus,
} from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import ResourceToolbar from "../toolbar";
import type { CardResource } from "../types";

const NONE = "none";
const EDITORS = [ROLES.RESOURCE];

interface ResourceBusiness {
  id: number;
  name: string;
  active: boolean;
}

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
  const { items: businesses, reload: reloadBusinesses } =
    useList<ResourceBusiness>("/api/resource-businesses");
  const sources = useSourceOptions();

  const [editing, setEditing] = useState<CardResource | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [deleting, setDeleting] = useState<CardResource | null>(null);
  const [history, setHistory] = useState<CardResource | null>(null);

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
                {CARD_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CARD_STATUS_LABEL[s]}
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
            <Button variant="outline" className="rounded-full" onClick={() => setBusinessOpen(true)}>
              <Settings2 size={14} />
              管理业务
            </Button>
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
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setHistory(c)}>
                    <TableCell className="font-mono text-xs">{c.cardNo || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.expiry || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.cvv || "-"}</TableCell>
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
                        <div className="flex flex-wrap gap-1">
                          {c.usage.split(",").filter(Boolean).map((name) => (
                            <Badge key={name} variant="outline">{name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {c.source?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CARD_STATUS_VARIANT[c.status as CardStatus]}>
                        {CARD_STATUS_LABEL[c.status as CardStatus] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                                setEditing(c);
                                setOpen(true);
                              }}
                            >
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleting(c)}
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

      <CardDialog open={open} onOpenChange={setOpen} initial={editing} businesses={businesses} onSaved={reload} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} businesses={businesses} onSaved={reload} />
      <BusinessDialog open={businessOpen} onOpenChange={setBusinessOpen} items={businesses} onSaved={reloadBusinesses} />
      <ResourceHistoryDialog kind="card" resource={history} label={history?.cardNo ?? "卡"} details={history ? [{ label: "卡号", value: history.cardNo }, { label: "有效期 / CVV", value: `${history.expiry || "-"} / ${history.cvv || "-"}` }, { label: "持卡人", value: history.holder }, { label: "余额", value: history.amount === null ? "-" : fmtMoneyShort(history.amount) }, { label: "适用业务", value: history.usage }, { label: "来源", value: history.source?.name }] : []} onOpenChange={(v) => !v && setHistory(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="删除这张卡？"
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/cards/${deleting.id}`), {
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

function CardDialog({
  open,
  onOpenChange,
  initial,
  businesses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: CardResource | null;
  businesses: ResourceBusiness[];
  onSaved: () => void;
}) {
  const [cardNo, setCardNo] = useState("");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [holder, setHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [usage, setUsage] = useState<string[]>([]);
  const [status, setStatus] = useState<CardStatus>("available");
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
    setUsage(initial?.usage.split(",").filter(Boolean) ?? []);
    setStatus((initial?.status as CardStatus) ?? "available");
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
      usage: usage.join(","),
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

          <Field label="持卡人">
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
          </Field>

          <Field label="适用业务" hint="可多选">
            <div className="flex flex-wrap gap-3 rounded-lg border border-border p-3">
              {businesses.filter((b) => b.active).map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={usage.includes(b.name)}
                    onCheckedChange={(checked) =>
                      setUsage((prev) => checked ? [...prev, b.name] : prev.filter((v) => v !== b.name))
                    }
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </Field>

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
              <Select value={status} onValueChange={(v) => setStatus(v as CardStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CARD_STATUS_LABEL[s]}
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
  businesses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businesses: ResourceBusiness[];
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [sourceId, setSourceId] = useState(NONE);
  const [usage, setUsage] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const sources = useSourceOptions(open);

  useEffect(() => {
    if (!open) return;
    setText("");
    setUsage([]);
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
            usage: usage.join(","),
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
              <div className="flex flex-wrap gap-3 min-h-9 items-center">
                {businesses.filter((b) => b.active).map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={usage.includes(b.name)}
                      onCheckedChange={(checked) =>
                        setUsage((prev) => checked ? [...prev, b.name] : prev.filter((v) => v !== b.name))
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
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

function BusinessDialog({
  open,
  onOpenChange,
  items,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ResourceBusiness[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return toast.warning("请填写业务名称");
    setSaving(true);
    try {
      const ok = await mutate(() => api.post("/api/resource-businesses", { name: name.trim() }), {
        success: "已添加",
        error: "添加失败",
      });
      if (ok) {
        setName("");
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>适用业务管理</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新业务名称" onKeyDown={(e) => e.key === "Enter" && void add()} />
          <Button onClick={add} disabled={saving}><Plus size={14} />添加</Button>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2">
              <SwitchBusiness item={item} onSaved={onSaved} />
              <span className="flex-1 text-sm font-medium">{item.name}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`删除 ${item.name}`}
                onClick={async () => {
                  const ok = await mutate(() => api.del(`/api/resource-businesses/${item.id}`), { error: "删除失败" });
                  if (ok) onSaved();
                }}
              ><Trash2 size={14} /></Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SwitchBusiness({ item, onSaved }: { item: ResourceBusiness; onSaved: () => void }) {
  return (
    <Checkbox
      checked={item.active}
      onCheckedChange={async (active) => {
        const ok = await mutate(
          () => api.patch(`/api/resource-businesses/${item.id}`, { active: Boolean(active) }),
          { error: "更新失败" },
        );
        if (ok) onSaved();
      }}
    />
  );
}
