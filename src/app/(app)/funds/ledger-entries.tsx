"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FINANCE_KIND_LABEL,
  FINANCE_KIND_VARIANT,
  FUND_CURRENCY_LABEL,
  FUND_CURRENCY_VARIANT,
  PAY_CHANNEL_LABEL,
  PAY_CHANNEL_VARIANT,
  isOneOf,
  PAY_CHANNEL,
  FUND_CURRENCY,
  type FinanceKind,
  type FundCurrency,
  type PayChannel,
} from "@/lib/enums";
import { fmtLedgerAmount, partyLabel, toCny } from "@/lib/format";

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
  if (isFrom) return { dir: "转出", name: partyLabel(row.toKind, row.toName, row.toId) };
  return { dir: "转入", name: partyLabel(row.fromKind, row.fromName, row.fromId) };
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
  if (!items.length) {
    return <p className="px-4 py-8 text-sm text-muted-foreground text-center">还没有和这个人对过账</p>;
  }
  return (
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
        {items.map((row) => {
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
              <TableCell>{side.name}</TableCell>
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
  );
}
