"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, MoreHorizontal, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList } from "@/hooks/use-list";
import { useDebounced } from "@/hooks/use-debounced";
import { api, mutate } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import {
  goodsKeywordVariant,
  parseSupplierCategories,
  splitGoodsNames,
  SUPPLIER_CATEGORY,
  SUPPLIER_CATEGORY_LABEL,
  SUPPLIER_CATEGORY_VARIANT,
} from "@/lib/enums";
import SupplierDialog from "./supplier-dialog";
import type { Supplier } from "../desks/types";

function websiteHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function copyText(label: string, value: string) {
  const ok = await copyToClipboard(value);
  if (ok) toast.success(`已复制${label}`);
  else toast.error("复制失败");
}

export default function SuppliersPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const debouncedQ = useDebounced(q);
  const path = useMemo(
    () => `/api/suppliers?${new URLSearchParams({ q: debouncedQ, category })}`,
    [debouncedQ, category],
  );
  const { items, loading, error, reload } = useList<Supplier>(path);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  return (
    <>
      <PageHeader
        title="供应商"
        subtitle="人脉记微信，卡网记网站和 TG；点进去看产品和评论"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={14} />
            新建供应商
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="搜索名称 / 微信 / TG / 网站 / 货" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {SUPPLIER_CATEGORY.map((value) => (
              <SelectItem key={value} value={value}>
                {SUPPLIER_CATEGORY_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有供应商" onRetry={reload}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => {
            const cats = parseSupplierCategories(s.category);
            return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">
                      <Link href={`/suppliers/${s.id}`} className="hover:text-primary">
                        {s.name}
                      </Link>
                    </CardTitle>
                    {cats.includes("cardshop") ? (
                      <div className="mt-1 space-y-0.5">
                        {s.baseUrl ? (
                          <a
                            href={websiteHref(s.baseUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{s.baseUrl}</span>
                            <ExternalLink size={12} className="shrink-0" />
                          </a>
                        ) : null}
                        {s.contact ? (
                          <button
                            type="button"
                            className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title="复制 Telegram"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void copyText("Telegram", s.contact);
                            }}
                          >
                            <span className="truncate">TG {s.contact}</span>
                            <Copy size={12} className="shrink-0" />
                          </button>
                        ) : null}
                        {s.wechat ? (
                          <button
                            type="button"
                            className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title="复制微信号"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void copyText("微信号", s.wechat);
                            }}
                          >
                            <span className="truncate">{s.wechat}</span>
                            <Copy size={12} className="shrink-0" />
                          </button>
                        ) : null}
                        {!s.baseUrl && !s.contact && !s.wechat ? (
                          <p className="text-xs text-muted-foreground">未填网站 / 联系方式</p>
                        ) : null}
                      </div>
                    ) : s.wechat ? (
                      <button
                        type="button"
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="复制微信号"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void copyText("微信号", s.wechat);
                        }}
                      >
                        <span className="truncate">{s.wechat}</span>
                        <Copy size={12} className="shrink-0" />
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">未填微信号</p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {cats.length
                      ? cats.map((value) => (
                          <Badge key={value} variant={SUPPLIER_CATEGORY_VARIANT[value]}>
                            {SUPPLIER_CATEGORY_LABEL[value]}
                          </Badge>
                        ))
                      : <Badge variant="secondary">未分类</Badge>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label="更多">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditing(s); setOpen(true); }}>
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(s)}>
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {s.goodsItems?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {s.goodsItems.map((good) => (
                      <Badge key={good.id} variant={goodsKeywordVariant(good.name)} className="gap-1">
                        <span>{good.name}</span>
                        {good.rate ? <span className="tabular-nums opacity-80">{good.rate}×</span> : null}
                      </Badge>
                    ))}
                  </div>
                ) : splitGoodsNames(s.goods).length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {splitGoodsNames(s.goods).map((tag) => (
                      <Badge key={tag} variant={goodsKeywordVariant(tag)}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">未填写可提供的货</p>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      </DataState>
      <SupplierDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={reload} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除供应商「${deleting?.name ?? ""}」？`}
        description="删除后将进入回收站，可随时恢复。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/suppliers/${deleting.id}`), { success: "已移至回收站", error: "删除失败" });
          setDeleting(null);
          if (ok) reload();
        }}
      />
    </>
  );
}
