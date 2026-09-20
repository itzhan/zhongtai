"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebounced } from "@/hooks/use-debounced";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";

interface Member {
  id: number;
  name: string;
  contact: string;
  note: string;
  active: boolean;
}

export default function MembersPage() {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const path = useMemo(() => `/api/members?q=${encodeURIComponent(debounced)}`, [debounced]);
  const { items, loading, error, reload } = useList<Member>(path);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function start(row: Member | null) {
    setEditing(row);
    setName(row?.name ?? "");
    setContact(row?.contact ?? "");
    setNote(row?.note ?? "");
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="搜索姓名 / 联系方式" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button className="rounded-full ml-auto" onClick={() => start(null)}>
          <Plus size={14} />
          新增成员
        </Button>
      </div>
      <DataState loading={loading} error={error} empty={!items.length} emptyText="还没有团队成员" onRetry={reload}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono tabular-nums">#{row.id}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/funds/members/${row.id}`} className="hover:text-primary">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.contact || "-"}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{row.note || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "success" : "secondary"}>{row.active ? "在用" : "停用"}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="更多">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => start(row)}>编辑</DropdownMenuItem>
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
            <DialogTitle>{editing ? "编辑成员" : "新增成员"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="姓名" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="对账时显示的名字" />
            </Field>
            <Field label="联系方式">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="微信 / 支付宝 / 卡号备注" />
            </Field>
            <Field label="备注">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!name.trim()) return;
                setSaving(true);
                const payload = { name: name.trim(), contact: contact.trim(), note: note.trim() };
                const ok = await mutate(
                  () => (editing ? api.patch(`/api/members/${editing.id}`, payload) : api.post("/api/members", payload)),
                  { success: editing ? "已保存" : "已新增", error: "保存失败" },
                );
                setSaving(false);
                if (ok) {
                  setOpen(false);
                  reload();
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除成员「${deleting?.name ?? ""}」？`}
        description="删除后进入回收站。已记过的账单仍保留当时的姓名。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/members/${deleting.id}`), {
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
