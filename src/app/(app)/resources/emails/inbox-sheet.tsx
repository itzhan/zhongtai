"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import DataState from "@/components/DataState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import { fmtDate } from "@/lib/format";
import type { EmailResource, MailMessage } from "../types";

/// 收件箱用 Sheet 而不是 Dialog: 它是「查看侧栏」不是决策弹窗, 而且
/// 邮件列表可能很长。
export default function InboxSheet({
  email,
  onOpenChange,
}: {
  email: EmailResource | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.post<{ items: MailMessage[] }>(`/api/emails/${email.id}/inbox`, {
        limit: 10,
      });
      setItems(r.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (email) void load();
    else setItems([]);
  }, [email, load]);

  return (
    <Sheet open={email !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 flex-row items-start justify-between gap-2 space-y-0">
          <div className="min-w-0">
            <SheetTitle className="text-base truncate">{email?.address}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              接码插件：{email?.providerKey}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="刷新"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="收件箱是空的"
            onRetry={load}
          >
            <div className="space-y-2">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border p-3 space-y-1.5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">{m.from}</p>
                    <p className="text-[11px] text-muted-foreground/60 shrink-0">
                      {fmtDate(m.receivedAt)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{m.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.snippet}</p>
                  {m.code && (
                    <Badge
                      variant="info"
                      className="cursor-pointer font-mono tracking-wider"
                      onClick={async () => {
                        const ok = await copyToClipboard(m.code!);
                        toast[ok ? "success" : "error"](ok ? "验证码已复制" : "复制失败");
                      }}
                    >
                      {m.code}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </DataState>
        </div>
      </SheetContent>
    </Sheet>
  );
}
