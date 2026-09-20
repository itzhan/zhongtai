"use client";
import { use, useEffect, useState } from "react";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { fmtMoneyShort } from "@/lib/format";
import LedgerEntriesTable, { ledgerStats, type LedgerRow } from "../../ledger-entries";

interface Member {
  id: number;
  name: string;
  contact: string;
  note: string;
  active: boolean;
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Member | null>(null);
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ item: Member }>(`/api/members/${id}`),
      api.get<{ items: LedgerRow[] }>(`/api/members/${id}/entries`),
    ])
      .then(([m, e]) => {
        setItem(m.item);
        setEntries(e.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const stats = item ? ledgerStats(entries, "member", item.id) : { out: 0, inn: 0, net: 0 };

  return (
    <>
      <PageHeader
        back="/funds/members"
        title={item?.name ?? "成员详情"}
        subtitle={item ? `ID #${item.id}${item.contact ? ` · ${item.contact}` : ""}` : undefined}
      />
      <DataState loading={loading} error={error} empty={!item} onRetry={() => location.reload()}>
        {item && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <StatCard label="转出（折人民币）" value={fmtMoneyShort(stats.out)} accent="warning" positiveIsGood={false} />
              <StatCard label="转入（折人民币）" value={fmtMoneyShort(stats.inn)} accent="success" />
              <StatCard label="净额" value={fmtMoneyShort(stats.net)} accent="primary" />
            </div>
            {item.note ? <p className="mb-4 text-sm text-muted-foreground">{item.note}</p> : null}
            <Card>
              <CardContent className="p-0">
                <LedgerEntriesTable items={entries} selfKind="member" selfId={item.id} />
              </CardContent>
            </Card>
          </>
        )}
      </DataState>
    </>
  );
}
