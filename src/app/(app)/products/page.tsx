"use client";
import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Package, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
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
import { Separator } from "@/components/ui/separator";
import { useList } from "@/hooks/use-list";
import { useDebounced } from "@/hooks/use-debounced";
import { api, mutate } from "@/lib/api-client";
import { statusVariant } from "@/lib/product-status";
import { ROLES } from "@/lib/rbac";
import ProductDialog from "./product-dialog";
import type { Product, ProjectOption } from "./types";

/// 产品的增删改归生产, 其余角色只读。
const EDITORS = [ROLES.ADMIN];

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () => `/api/products?${new URLSearchParams({ q: debouncedQ, projectId }).toString()}`,
    [debouncedQ, projectId],
  );
  const { items, loading, error, reload } = useList<Product>(path);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => {
    api
      .get<{ items: ProjectOption[] }>("/api/projects")
      .then((r) => setProjects(r.items))
      .catch(() => setProjects([]));
  }, []);

  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="产品管理"
        subtitle="手里有什么货、当前状态与产能"
        actions={
          <RoleGate roles={EDITORS}>
            <Button className="rounded-full" onClick={openNew}>
              <Plus size={14} />
              新增产品
            </Button>
          </RoleGate>
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
            placeholder="搜索产品名称"
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
            <SelectItem value="none">通用（未绑定）</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyText="还没有产品"
        onRetry={reload}
        emptyAction={
          <RoleGate roles={EDITORS}>
            <Button size="sm" variant="secondary" onClick={openNew}>
              <Plus size={14} />
              新增产品
            </Button>
          </RoleGate>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => {
                setEditing(p);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      </DataState>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除产品「${deleting?.name ?? ""}」？`}
        description="已被台子明细、供货明细或产出批次引用的产品暂不能移入回收站。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/products/${deleting.id}`), {
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

function ProductCard({
  product: p,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-2xl overflow-hidden hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight truncate" title={p.name}>
                {p.name}
              </h3>
              <p className="text-[11px] text-muted-foreground/60 truncate">
                {p.project ? p.project.name : "通用"}
              </p>
            </div>
          </div>

          <RoleGate roles={EDITORS}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="-mr-1 shrink-0" aria-label="更多">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>编辑</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </RoleGate>
        </div>

        {/* 状态是自由文本, 颜色由关键词推导, 推不出就中性灰 */}
        <Badge variant={statusVariant(p.status)} className="max-w-full">
          <span className="truncate" title={p.status ?? undefined}>
            {p.status?.trim() || "未填写状态"}
          </span>
        </Badge>

        <Separator />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            产能
          </span>
          <span className="text-sm font-medium truncate" title={p.capacity ?? undefined}>
            {p.capacity?.trim() || <span className="text-muted-foreground/50">-</span>}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
