"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import PartyLink from "@/components/PartyLink";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FINANCE_KIND,
  FINANCE_KIND_LABEL,
  FINANCE_KIND_VARIANT,
  FUND_CURRENCY,
  FUND_CURRENCY_LABEL,
  FUND_CURRENCY_VARIANT,
  PAY_CHANNEL,
  PAY_CHANNEL_LABEL,
  PAY_CHANNEL_VARIANT,
  isOneOf,
  type FinanceKind,
  type FundCurrency,
  type PayChannel,
} from "@/lib/enums";
import { fmtLedgerAmount, toCny } from "@/lib/format";

export interface LedgerRow {
  id: number;
  kind: FinanceKind | string;
  amount: number | null;
  currency: string;
  channel: string;
  fromKind: string;
  fromId: number | null;
  fromName: string;
  toKind: string;
  toId: number | null;
  toName: string;
  note: string;
  entryDate: string;
  project?: { id: number; code: string; name: string } | null;
}

export function counterpartOf(row: LedgerRow, kind: string, id: number) {
  const isFrom = row.fromKind === kind && row.fromId === id;
  if (isFrom) {
    return { dir: "转出" as const, kind: row.toKind, id: row.toId, name: row.toName };
  }
  return { dir: "转入" as const, kind: row.fromKind, id: row.fromId, name: row.fromName };
}

export function ledgerStats(rows: LedgerRow[], kind: string, id: number) {
  let out = 0;
  let inn = 0;
  for (const r of rows) {
    const n = r.amount == null ? 0 : toCny(r.amount, r.currency);
    if (r.fromKind === kind && r.fromId === id) out += n;
    if (r.toKind === kind && r.toId === id) inn += n;
  }
  return { out, inn, net: inn - out };
}

export default function LedgerEntriesTable({
  items,
  selfKind,
  selfId,
}: {
  items: LedgerRow[];
  selfKind: string;
  selfId: number;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [dir, setDir] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const projects = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of items) {
      if (row.project) map.set(row.project.id, row.project.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((row) => {
      if (kind !== "all" && row.kind !== kind) return false;
      if (channel !== "all" && row.channel !== channel) return false;
      if (projectId !== "all" && String(row.project?.id) !== projectId) return false;
      if (from && row.entryDate < from) return false;
      if (to && row.entryDate > to) return false;
      const outgoing = row.fromKind === selfKind && row.fromId === selfId;
      if (dir === "out" && !outgoing) return false;
      if (dir === "in" && outgoing) return false;
      if (needle) {
        const other = counterpartOf(row, selfKind, selfId);
        const hay = `${row.note} ${other.name} ${row.project?.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, kind, dir, projectId, channel, from, to, selfKind, selfId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 p-3 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-48" placeholder="搜索用途 / 对方 / 项目" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部方向</SelectItem>
            {FINANCE_KIND.map((k) => (
              <SelectItem key={k} value={k}>
                {FINANCE_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dir} onValueChange={setDir}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">转入转出</SelectItem>
            <SelectItem value="out">转出</SelectItem>
            <SelectItem value="in">转入</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="项目" />
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
        <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="开始日期" />
        <span className="text-muted-foreground text-sm">至</span>
        <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="结束日期" />
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground text-center">
          {items.length === 0 ? "还没有和这个人对过账" : "这个条件下没有记录"}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>方向</TableHead>
              <TableHead>对方</TableHead>
              <TableHead>项目</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>用途</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const side = counterpartOf(row, selfKind, selfId);
              const outgoing = row.fromKind === selfKind && row.fromId === selfId;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.entryDate}</TableCell>
                  <TableCell>
                    <Badge variant={FINANCE_KIND_VARIANT[(row.kind as FinanceKind) ?? "cost"]}>
                      {FINANCE_KIND_LABEL[(row.kind as FinanceKind) ?? "cost"] ?? row.kind}
                      · {side.dir}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PartyLink kind={side.kind} id={side.id} name={side.name} />
                  </TableCell>
                  <TableCell>
                    {row.project ? (
                      <Link href={`/projects/${row.project.id}`} className="hover:text-primary">
                        {row.project.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {isOneOf(FUND_CURRENCY, row.currency) ? (
                        <Badge variant={FUND_CURRENCY_VARIANT[row.currency as FundCurrency]}>
                          {FUND_CURRENCY_LABEL[row.currency as FundCurrency]}
                        </Badge>
                      ) : null}
                      {isOneOf(PAY_CHANNEL, row.channel) ? (
                        <Badge variant={PAY_CHANNEL_VARIANT[row.channel as PayChannel]}>
                          {PAY_CHANNEL_LABEL[row.channel as PayChannel]}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${outgoing ? "text-warning" : "text-success"}`}
                  >
                    {row.amount == null ? "···" : fmtLedgerAmount(row.amount, row.currency)}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">{row.note || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
