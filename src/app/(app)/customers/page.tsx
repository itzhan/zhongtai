"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced } from "@/hooks/use-debounced";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import {
  CUSTOMER_PLATFORM,
  CUSTOMER_PLATFORM_LABEL,
  CUSTOMER_PLATFORM_VARIANT,
  isOneOf,
  PARTNER_STATUS,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_VARIANT,
} from "@/lib/enums";
import CustomerDialog from "./customer-dialog";
import type { Customer } from "./types";

export default function CustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);
  const path = useMemo(
    () => `/api/customers?${new URLSearchParams({ q: debouncedQ, status })}`,
    [debouncedQ, status],
  );
  const { items, loading, error, reload } = useList<Customer>(path);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  return (
    <>
      <PageHeader
        title="客户管理"
        subtitle="记录客户买了什么、怎么卖、成本怎么算，绑定 sub2 用户后看消耗和利润"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={14} />
            新增客户
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="搜索客户 / 归属 / 绑定用户" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {PARTNER_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {PARTNER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有客户" onRetry={reload}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">
                      <Link href={`/customers/${c.id}`} className="hover:text-primary">
                        {c.name}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.ownerName || c.owner?.displayName || "-"}
                      {c.sub2UserName || c.sub2UserEmail
                        ? ` · ${c.sub2UserName || c.sub2UserEmail}`
                        : " · 未绑定 sub2"}
                    </p>
                  </div>
                  <Badge variant={PARTNER_STATUS_VARIANT[c.status]}>{PARTNER_STATUS_LABEL[c.status]}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label="更多">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(`/customers/${c.id}`)}>详情</DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(c)}>
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.contact ? <p className="text-xs text-muted-foreground truncate">{c.contact}</p> : null}
                <div className="flex flex-wrap gap-1.5">
                  {c.resources.length ? (
                    c.resources.map((r) => (
                      <Badge
                        key={r.id}
                        variant={isOneOf(CUSTOMER_PLATFORM, r.platform) ? CUSTOMER_PLATFORM_VARIANT[r.platform] : "secondary"}
                      >
                        {r.name}
                        {isOneOf(CUSTOMER_PLATFORM, r.platform) ? ` · ${CUSTOMER_PLATFORM_LABEL[r.platform]}` : ""}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">还没有资源，点进去添加</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DataState>
      <CustomerDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={(id) => {
          reload();
          if (!editing && id) router.push(`/customers/${id}`);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除客户「${deleting?.name ?? ""}」？`}
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/customers/${deleting.id}`), {
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
