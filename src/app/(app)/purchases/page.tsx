"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Receipt, Search, ShoppingCart, TrendingUp } from "lucide-react";
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
import { api, mutate } from "@/lib/api-client";
import PartyLink from "@/components/PartyLink";
import PartyPicker from "@/components/PartyPicker";
import PurposeCell from "@/components/PurposeCell";
import { useMemberOptions, usePartnerOptions, useProjectOptions } from "@/hooks/use-options";
import {
  FUND_CURRENCY,
  FUND_CURRENCY_LABEL,
  PAY_CHANNEL,
  PAY_CHANNEL_LABEL,
  PAY_CHANNEL_VARIANT,
  isOneOf,
  type FundCurrency,
  type PartyKind,
  type PayChannel,
} from "@/lib/enums";
import { fmtLedgerAmount, fmtMinute, fmtMoneyShort, nowDatetimeLocal, toCny, toDatetimeLocal } from "@/lib/format";
import type { Purchase } from "./types";

export default function PurchasesPage() {
  const [projectId, setProjectId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [party, setParty] = useState("all");

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
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      if (channel !== "all" && p.channel !== channel) return false;
      if (party !== "all") {
        const [kind, id] = party.split(":");
        const match =
          (p.fromKind === kind && String(p.fromId) === id) || (p.toKind === kind && String(p.toId) === id);
        if (!match) return false;
      }
      if (needle) {
        const hay = `${p.content || ""} ${p.note || ""} ${p.fromName || ""} ${p.toName || ""} ${p.project?.name || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, channel, party]);
  const parties = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of items) {
      if (p.fromId && p.fromName) map.set(`${p.fromKind}:${p.fromId}`, p.fromName);
      if (p.toId && p.toName) map.set(`${p.toKind}:${p.toId}`, p.toName);
    }
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [items]);

  const [editing, setEditing] = useState<Purchase | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const stats = useMemo(() => {
    const amounts = visible.map((p) => toCny(p.totalAmount ?? 0, p.currency));
    return {
      total: amounts.reduce((s, a) => s + a, 0),
      count: visible.length,
      max: amounts.length ? Math.max(...amounts) : 0,
    };
  }, [visible]);

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
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-48" placeholder="搜索用途 / 人名 / 项目" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
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
        <Select value={party} onValueChange={setParty}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="人员" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部人员</SelectItem>
            {parties.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部渠道</SelectItem>
            {PAY_CHANNEL.map((c) => (
              <SelectItem key={c} value={c}>
                {PAY_CHANNEL_LABEL[c]}
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
            empty={visible.length === 0}
            emptyText="这个条件下还没有成本记录"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>转出</TableHead>
                  <TableHead>转入</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setViewing(p)}>
                    <TableCell className="font-medium">
                      {p.project ? (
                        <Link href={`/projects/${p.project.id}`} className="hover:text-primary" onClick={(e) => e.stopPropagation()}>
                          {p.project.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <PartyLink kind={p.fromKind} id={p.fromId} name={p.fromName} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <PartyLink kind={p.toKind} id={p.toId} name={p.toName} />
                    </TableCell>
                    <TableCell>
                      {isOneOf(PAY_CHANNEL, p.channel) ? (
                        <Badge variant={PAY_CHANNEL_VARIANT[p.channel]}>{PAY_CHANNEL_LABEL[p.channel]}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="align-top min-w-[14rem]">
                      <PurposeCell text={p.detail || p.content || p.note} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {p.totalAmount === null ? (
                        <span className="text-muted-foreground/50">···</span>
                      ) : (
                        fmtLedgerAmount(p.totalAmount, p.currency)
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {fmtMinute(p.entryAt || p.createdAt, p.purchaseDate || p.entryDate)}
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
                <Info
                  label="项目"
                  value={
                    viewing.project ? (
                      <Link href={`/projects/${viewing.project.id}`} className="hover:text-primary">
                        {viewing.project.name}
                      </Link>
                    ) : (
                      "-"
                    )
                  }
                />
                <Info label="时间" value={fmtMinute(viewing.entryAt || viewing.createdAt, viewing.purchaseDate || viewing.entryDate)} />
                <Info label="转出" value={<PartyLink kind={viewing.fromKind} id={viewing.fromId} name={viewing.fromName} />} />
                <Info label="转入" value={<PartyLink kind={viewing.toKind} id={viewing.toId} name={viewing.toName} />} />
                <Info
                  label="渠道"
                  value={isOneOf(PAY_CHANNEL, viewing.channel) ? PAY_CHANNEL_LABEL[viewing.channel] : "-"}
                />
                <Info
                  label="金额"
                  value={
                    viewing.totalAmount === null ? "-" : fmtLedgerAmount(viewing.totalAmount, viewing.currency)
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
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
  const members = useMemberOptions(open);
  const partners = usePartnerOptions(open);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [fromKind, setFromKind] = useState<PartyKind>("member");
  const [fromId, setFromId] = useState<number | null>(null);
  const [toKind, setToKind] = useState<PartyKind>("partner");
  const [toId, setToId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<FundCurrency>("cny");
  const [channel, setChannel] = useState<PayChannel | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setNote(initial?.detail || initial?.content || initial?.note || "");
    setTotalAmount(initial?.totalAmount != null ? String(initial.totalAmount) : "");
    setPurchaseDate(initial ? toDatetimeLocal(initial.entryAt, initial.purchaseDate || initial.entryDate) : nowDatetimeLocal());
    setPurchaserName(initial?.purchaserName || initial?.purchaser.displayName || "");
    setFromKind((initial?.fromKind as PartyKind) || "member");
    setFromId(initial?.fromId ?? null);
    setToKind((initial?.toKind as PartyKind) || "partner");
    setToId(initial?.toId ?? null);
    setCurrency((initial?.currency as FundCurrency) || "cny");
    setChannel((initial?.channel as PayChannel) || "");
  }, [open, initial]);

  async function save() {
    if (!projectId) return toast.warning("请选择归属项目");
    if (!note.trim()) return toast.warning("请填写花销说明");
    const amt = Number(totalAmount);
    if (!Number.isFinite(amt) || amt < 0) return toast.warning("金额非法");
    if (!fromId) return toast.warning("请选择转出人");
    if (!toId) return toast.warning("请选择转入人");
    if (!channel) return toast.warning("请选择转账渠道");

    const payload = {
      projectId: Number(projectId),
      note: note.trim(),
      content: note.trim(),
      detail: note.trim(),
      totalAmount: amt,
      purchaseDate,
      purchaserName: purchaserName.trim() || undefined,
      fromKind,
      fromId,
      toKind,
      toId,
      currency,
      channel,
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

          <PartyPicker
            label="转出人"
            kind={fromKind}
            id={fromId}
            members={members}
            partners={partners}
            onChange={(k, id) => {
              setFromKind(k);
              setFromId(id);
            }}
          />
          <PartyPicker
            label="转入人"
            kind={toKind}
            id={toId}
            members={members}
            partners={partners}
            onChange={(k, id) => {
              setToKind(k);
              setToId(id);
            }}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="时间" required>
              <Input
                type="datetime-local"
                step={60}
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
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
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="币种" required>
              <Select value={currency} onValueChange={(v) => setCurrency(v as FundCurrency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUND_CURRENCY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {FUND_CURRENCY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="渠道" required>
              <Select value={channel || undefined} onValueChange={(v) => setChannel(v as PayChannel)}>
                <SelectTrigger>
                  <SelectValue placeholder="支付宝 / 微信 / 银行卡" />
                </SelectTrigger>
                <SelectContent>
                  {PAY_CHANNEL.map((c) => (
                    <SelectItem key={c} value={c}>
                      {PAY_CHANNEL_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="这笔钱是干啥的" required>
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
