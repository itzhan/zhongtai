"use client";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import PartnerItemsDetail from "@/components/PartnerItemsDetail";
import { useCan } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useList } from "@/hooks/use-list";
import { useDebounced } from "@/hooks/use-debounced";
import { useProjectOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PARTNER_STATUS, PARTNER_STATUS_LABEL, PARTNER_STATUS_VARIANT } from "@/lib/enums";
import { fmtMoneyShort } from "@/lib/format";
import DeskDialog from "./desk-dialog";
import type { Desk } from "./types";

export default function DesksPage() {
  const can = useCan();
  const showPrice = can("price");

  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () =>
      `/api/desks?${new URLSearchParams({ q: debouncedQ, projectId, status }).toString()}`,
    [debouncedQ, projectId, status],
  );
  const { items, loading, error, reload } = useList<Desk>(path);
  const projects = useProjectOptions();

  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<Desk | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Desk | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const colSpan = showPrice ? 8 : 7;

  return (
    <>
      <PageHeader
        title="台子管理"
        subtitle="下游客户与货需求"
        actions={
          <Button className="rounded-full" onClick={openNew}>
            <Plus size={14} />
            新增台子
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            className="pl-8 w-56"
            placeholder="搜索名称或联系方式"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部项目</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.code} · {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有台子，点右上角「新增台子」开始"
            onRetry={reload}
            emptyAction={
              <Button size="sm" variant="secondary" onClick={openNew}>
                <Plus size={14} />
                新增台子
              </Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>台子</TableHead>
                  <TableHead>归属销售</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>货需求</TableHead>
                  {showPrice && <TableHead className="text-right">卖价合计</TableHead>}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => {
                  const open = expanded === d.id;
                  const total = d.items.reduce(
                    (s, i) => s + i.quantity * (i.unitPrice ?? 0),
                    0,
                  );
                  return (
                    <Fragment key={d.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={open ? "收起明细" : "展开明细"}
                            onClick={() => setExpanded(open ? null : d.id)}
                          >
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{d.name}</p>
                          {d.contact && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {d.contact}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.owner?.displayName ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {d.project?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={PARTNER_STATUS_VARIANT[d.status]}>
                            {PARTNER_STATUS_LABEL[d.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.items.length > 0 ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="secondary">{d.items.length} 项</Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                {d.items[0].product.name}
                                {d.items.length > 1 && " 等"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                        {showPrice && (
                          <TableCell className="text-right tabular-nums font-medium">
                            {d.items.length ? fmtMoneyShort(total) : "-"}
                          </TableCell>
                        )}
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
                                  setEditing(d);
                                  setDialogOpen(true);
                                }}
                              >
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(d)}
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {open && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={colSpan} className="p-3">
                            {d.demand && (
                              <p className="text-xs text-muted-foreground mb-2 whitespace-pre-wrap">
                                {d.demand}
                              </p>
                            )}
                            <PartnerItemsDetail
                              items={d.items}
                              priceLabel="卖价"
                              showPrice={showPrice}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <DeskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除台子「${deleting?.name ?? ""}」？`}
        description="该台子的货需求明细会一并删除。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/desks/${deleting.id}`), {
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
