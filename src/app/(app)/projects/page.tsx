"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RoleGate from "@/components/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useList } from "@/hooks/use-list";
import { useDebounced } from "@/hooks/use-debounced";
import { api, mutate } from "@/lib/api-client";
import { PROJECT_STATUS, PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/enums";
import { fmtDay } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import ProjectDialog from "./project-dialog";
import type { Project } from "./types";

/// 立项与改项目只有管理员能做, 其余角色是只读。
const ADMIN_ONLY = [ROLES.ADMIN];

export default function ProjectsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedQ = useDebounced(q);

  const path = useMemo(
    () => `/api/projects?${new URLSearchParams({ q: debouncedQ, status }).toString()}`,
    [debouncedQ, status],
  );
  const { items, loading, error, reload } = useList<Project>(path);

  const [editing, setEditing] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);

  return (
    <>
      <PageHeader
        title="项目管理"
        subtitle="立项与项目维度的成本利润"
        actions={
          <RoleGate roles={ADMIN_ONLY}>
            <Button
              className="rounded-full"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus size={14} />
              新建项目
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
            placeholder="搜索项目名称"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {PROJECT_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有项目，点右上角「新建项目」开始"
            onRetry={reload}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => <Card key={p.id} className="h-full"><CardHeader className="pb-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><CardTitle className="text-base"><Link href={`/projects/${p.id}`} className="hover:text-primary">{p.name}</Link></CardTitle><p className="mt-1 text-xs text-muted-foreground">负责人：{p.ownerName || p.owner?.displayName || "-"}</p></div><Badge variant={PROJECT_STATUS_VARIANT[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                      <RoleGate roles={ADMIN_ONLY}>
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
                                setDialogOpen(true);
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
                      </RoleGate>
                    </div></CardHeader><CardContent><p className="min-h-12 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{p.description || "暂无项目说明"}</p><div className="mt-4 grid grid-cols-3 border-t pt-3 text-center"><div><p className="font-semibold">{p._count.desks}</p><p className="text-xs text-muted-foreground">台子</p></div><div><p className="font-semibold">{p._count.products}</p><p className="text-xs text-muted-foreground">产品</p></div><div><p className="font-semibold">{p._count.purchases}</p><p className="text-xs text-muted-foreground">采购</p></div></div><p className="mt-3 text-xs text-muted-foreground">创建于 {fmtDay(p.startedAt)}</p></CardContent></Card>)}
            </div>
          </DataState>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除项目「${deleting?.name ?? ""}」？`}
        description="仅当项目下没有台子、供货方和采购记录时才能移入回收站。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/projects/${deleting.id}`), {
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
