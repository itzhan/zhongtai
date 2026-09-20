"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Landmark, Loader2, MoreHorizontal, Plus, Receipt, Wallet } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import StatCard from "@/components/StatCard";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import {
  FUND_CURRENCY,
  FUND_CURRENCY_LABEL,
  FUND_CURRENCY_VARIANT,
  FUND_KIND,
  FUND_KIND_LABEL,
  FUND_KIND_VARIANT,
  type FundCurrency,
  type FundKind,
} from "@/lib/enums";
import { fmtMoneyShort, USDT_CNY_RATE, usdtToCny } from "@/lib/format";

interface Fund {
  id: number;
  holder: string;
  name: string;
  kind: FundKind;
  currency: FundCurrency;
  amount: number | null;
  uncertain: boolean;
  note: string;
}

type Filter = "all" | FundKind;

function fmtFund(row: Pick<Fund, "amount" | "currency" | "uncertain">): string {
  if (row.uncertain) return "未确定";
  if (row.amount == null) return "···";
  const n = fmtMoneyShort(row.amount);
  return row.currency === "usdt" ? `${n} U` : n;
}

export default function FundsPage() {
  const { items, loading, error, reload } = useList<Fund>("/api/funds");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Fund | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Fund | null>(null);

  const stats = useMemo(() => {
    const sum = (kind: FundKind, currency: FundCurrency) =>
      items
        .filter((x) => x.kind === kind && x.currency === currency && !x.uncertain)
        .reduce((s, x) => s + (x.amount ?? 0), 0);
    const heldCny = sum("held", "cny");
    const heldUsdt = sum("held", "usdt");
    const recvCny = sum("receivable", "cny");
    const recvUsdt = sum("receivable", "usdt");
    return {
      heldCny,
      heldUsdt,
      heldTotalCny: heldCny + usdtToCny(heldUsdt),
      recvCny,
      recvUsdt,
      recvTotalCny: recvCny + usdtToCny(recvUsdt),
    };
  }, [items]);

  const rows = useMemo(
    () => (filter === "all" ? items : items.filter((x) => x.kind === filter)),
    [items, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Fund[]>();
    for (const row of rows) {
      const key = row.holder || "未分组";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    const preferred = ["刘赛", "金", "秋明", "卡台", "外债"];
    const keys = [...map.keys()].sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "zh");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((k) => [k, map.get(k)!] as [string, Fund[]]);
  }, [rows]);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button className="rounded-full" onClick={openNew}>
          <Plus size={14} />
          新增
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard
          label="总持有金额"
          value={fmtMoneyShort(stats.heldTotalCny)}
          hint={`U 按 ${USDT_CNY_RATE} 折人民币`}
          icon={Landmark}
          accent="success"
        />
        <StatCard label="所持人民币" value={fmtMoneyShort(stats.heldCny)} icon={Wallet} accent="primary" />
        <StatCard
          label="所持 U"
          value={`${fmtMoneyShort(stats.heldUsdt)} U`}
          hint={`约 ${fmtMoneyShort(usdtToCny(stats.heldUsdt))}`}
          icon={Wallet}
          accent="default"
        />
        <StatCard
          label="未结账单"
          value={fmtMoneyShort(stats.recvTotalCny)}
          hint={stats.recvUsdt ? `含 ${fmtMoneyShort(stats.recvUsdt)} U` : undefined}
          icon={Receipt}
          accent="warning"
        />
      </div>

      <div className="mb-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            {FUND_KIND.map((k) => (
              <TabsTrigger key={k} value={k}>
                {FUND_KIND_LABEL[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={rows.length === 0}
            emptyText={filter === "all" ? "还没有资金记录" : "这一类还没有记录"}
            onRetry={reload}
            emptyAction={
              <Button size="sm" variant="secondary" onClick={openNew}>
                <Plus size={14} />
                新增
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>位置 / 账户</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(([holder, list]) => (
                  <Fragment key={holder}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={6} className="font-medium py-2">
                        {holder}
                      </TableCell>
                    </TableRow>
                    {list.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>
                          <Badge variant={FUND_KIND_VARIANT[row.kind]}>{FUND_KIND_LABEL[row.kind]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={FUND_CURRENCY_VARIANT[row.currency]}>
                            {FUND_CURRENCY_LABEL[row.currency]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="tabular-nums font-medium">{fmtFund(row)}</div>
                          {row.currency === "usdt" && !row.uncertain && row.amount != null ? (
                            <div className="text-xs text-muted-foreground">
                              约 {fmtMoneyShort(usdtToCny(row.amount))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[280px] truncate">
                          {row.note || "-"}
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
                                  setEditing(row);
                                  setOpen(true);
                                }}
                              >
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(row)}
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <FundDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除「${deleting?.holder ?? ""} · ${deleting?.name ?? ""}」？`}
        description="删除后可在回收站恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/funds/${deleting.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          if (ok) {
            setDeleting(null);
            reload();
          }
        }}
      />
    </>
  );
}

function FundDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Fund | null;
  onSaved: () => void;
}) {
  const [holder, setHolder] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FundKind>("held");
  const [currency, setCurrency] = useState<FundCurrency>("cny");
  const [amount, setAmount] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHolder(initial?.holder ?? "");
    setName(initial?.name ?? "");
    setKind(initial?.kind ?? "held");
    setCurrency(initial?.currency ?? "cny");
    setUncertain(Boolean(initial?.uncertain));
    setAmount(initial?.uncertain || initial?.amount == null ? "" : String(initial.amount));
    setNote(initial?.note ?? "");
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑资金" : "新增资金"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="类型" required>
            <Tabs value={kind} onValueChange={(v) => setKind(v as FundKind)}>
              <TabsList className="w-full">
                {FUND_KIND.map((k) => (
                  <TabsTrigger key={k} value={k} className="flex-1">
                    {FUND_KIND_LABEL[k]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Field>
          <Field label="归属" required hint="例如刘赛、金、秋明、卡台">
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="刘赛" />
          </Field>
          <Field
            label={kind === "receivable" ? "甲方 / 对方" : "位置 / 账户"}
            required
            hint={kind === "held" ? "例如交行建行、公户、U卡、BNB" : undefined}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "held" ? "交行建行" : "对方名称"}
            />
          </Field>
          <Field label="币种" required>
            <Tabs value={currency} onValueChange={(v) => setCurrency(v as FundCurrency)}>
              <TabsList className="w-full">
                {FUND_CURRENCY.map((c) => (
                  <TabsTrigger key={c} value={c} className="flex-1">
                    {FUND_CURRENCY_LABEL[c]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Field>
          <Field label="金额">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              disabled={uncertain}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <Checkbox checked={uncertain} onCheckedChange={(v) => setUncertain(v === true)} />
              金额未确定
            </label>
          </Field>
          <Field label="备注">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!holder.trim()) return toast.warning("请填写归属");
              if (!name.trim()) return toast.warning("请填写位置或对方");
              const n = uncertain ? 0 : Number(amount);
              if (!uncertain && (!Number.isFinite(n) || n < 0)) return toast.warning("金额非法");
              setSaving(true);
              const payload = {
                holder: holder.trim(),
                name: name.trim(),
                kind,
                currency,
                amount: n,
                uncertain,
                note: note.trim(),
              };
              const ok = await mutate(
                () =>
                  initial
                    ? api.patch(`/api/funds/${initial.id}`, payload)
                    : api.post("/api/funds", payload),
                { success: initial ? "已保存" : "已新增", error: "保存失败" },
              );
              setSaving(false);
              if (ok) {
                onOpenChange(false);
                onSaved();
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
