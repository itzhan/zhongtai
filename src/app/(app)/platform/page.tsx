"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";

interface SiteRow {
  id: number;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  enabled: boolean;
  _count?: { monitors: number; customers?: number };
}

const emptyForm = { name: "", baseUrl: "", apiKey: "" };

export default function PlatformPage() {
  const { items, loading, error, reload } = useList<SiteRow>("/api/sub2-sites");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [deleting, setDeleting] = useState<SiteRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: SiteRow) {
    setEditing(row);
    setForm({ name: row.name, baseUrl: row.baseUrl, apiKey: "" });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.warning("请填写中台名称");
    if (!form.baseUrl.trim()) return toast.warning("请填写 sub2 地址");
    if (!editing && !form.apiKey.trim()) return toast.warning("请填写管理员 API Key");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      };
      const ok = await mutate(
        () => (editing ? api.patch(`/api/sub2-sites/${editing.id}`, payload) : api.post("/api/sub2-sites", payload)),
        { success: editing ? "已保存" : "已添加", error: "保存失败" },
      );
      if (ok) {
        setOpen(false);
        reload();
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConn() {
    if (!form.baseUrl.trim()) return toast.warning("请填写 sub2 地址");
    if (!form.apiKey.trim() && !editing) return toast.warning("请填写管理员 API Key");
    setTesting(true);
    try {
      const path = editing ? `/api/sub2-sites/${editing.id}/test` : "/api/sub2-sites/ping";
      const r = await api.post<{ item: { accountCount: number } }>(path, {
        baseUrl: form.baseUrl.trim(),
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      });
      toast.success(`连通正常，拉到 ${r.item.accountCount} 个上游账号`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "测连通失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="中台管理"
        subtitle="录入 sub2api 的地址和管理员 Key，客户绑定用户后即可追踪消耗"
        actions={
          <Button className="rounded-full" onClick={openCreate}>
            <Plus size={14} />
            添加中台
          </Button>
        }
      />
      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有中台" onRetry={reload}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>调度</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[360px] truncate">{row.baseUrl}</TableCell>
                    <TableCell>
                      <Badge variant={row.hasApiKey ? "success" : "warning"}>{row.hasApiKey ? "已填写" : "未填"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.enabled ? "info" : "secondary"}>{row.enabled ? "自动调度开" : "未开调度"}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="更多">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>编辑</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(row)}>
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DataState>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑中台" : "添加中台"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="名称" required>
              <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="例如 主站" />
            </Field>
            <Field label="Sub2 URL" required>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm((c) => ({ ...c, baseUrl: e.target.value }))}
                placeholder="https://xxx.com"
              />
            </Field>
            <Field label="管理员 API Key" required={!editing} hint={editing ? "留空表示不改" : "x-api-key"}>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((c) => ({ ...c, apiKey: e.target.value }))}
                placeholder={editing ? "留空不修改" : "sk-..."}
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={testing} onClick={() => void testConn()}>
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              测连通
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除中台「${deleting?.name ?? ""}」？`}
        description="已绑定的客户会解除 sub2 用户绑定，自动调度里的渠道绑定也会清掉。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/sub2-sites/${deleting.id}`), {
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
