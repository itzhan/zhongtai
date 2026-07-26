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
            placeholder="搜索代号或名称"
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

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有项目，点右上角「新建项目」开始"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead className="text-right">台子</TableHead>
                  <TableHead className="text-right">产品</TableHead>
                  <TableHead className="text-right">采购</TableHead>
                  <TableHead>立项时间</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/projects/${p.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PROJECT_STATUS_VARIANT[p.status]}>
                        {PROJECT_STATUS_LABEL[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.owner?.displayName ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.desks}</TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.products}</TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.purchases}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDay(p.startedAt)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

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
        description="仅当项目下没有台子、供货方和采购记录时才能删除。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/projects/${deleting.id}`), {
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
