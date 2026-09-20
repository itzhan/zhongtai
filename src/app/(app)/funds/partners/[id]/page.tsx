"use client";
import { use, useEffect, useState } from "react";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { fmtMoneyShort } from "@/lib/format";
import LedgerEntriesTable, { ledgerStats, type LedgerRow } from "../../ledger-entries";

interface PartnerRow {
  id: number;
  name: string;
  contact: string;
  note: string;
}

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<PartnerRow | null>(null);
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ item: PartnerRow }>(`/api/partners/${id}`),
      api.get<{ items: LedgerRow[] }>(`/api/partners/${id}/entries`),
    ])
      .then(([m, e]) => {
        setItem(m.item);
        setEntries(e.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const stats = item ? ledgerStats(entries, "partner", item.id) : { out: 0, inn: 0, net: 0 };

  return (
    <>
      <PageHeader
        back="/funds/partners"
        title={item?.name ?? "伙伴详情"}
        subtitle={item?.contact || undefined}
      />
      <DataState loading={loading} error={error} empty={!item} onRetry={() => location.reload()}>
        {item && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <StatCard label="我们付给对方（折人民币）" value={fmtMoneyShort(stats.inn)} accent="warning" positiveIsGood={false} />
              <StatCard label="对方付给我们（折人民币）" value={fmtMoneyShort(stats.out)} accent="success" />
              <StatCard label="净额（对方付 − 我们付）" value={fmtMoneyShort(stats.out - stats.inn)} accent="primary" />
            </div>
            {item.note ? <p className="mb-4 text-sm text-muted-foreground">{item.note}</p> : null}
            <Card>
              <CardContent className="p-0">
                <LedgerEntriesTable items={entries} selfKind="partner" selfId={item.id} />
              </CardContent>
            </Card>
          </>
        )}
      </DataState>
    </>
  );
}
