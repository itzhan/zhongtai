"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, mutate } from "@/lib/api-client";
import type { Product, ProjectOption } from "./types";

const NONE = "none";

export default function ProductDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Product | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [capacity, setCapacity] = useState("");
  const [projectId, setProjectId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setStatus(initial?.status ?? "");
    setCapacity(initial?.capacity ?? "");
    setProjectId(initial?.projectId ? String(initial.projectId) : NONE);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: ProjectOption[] }>("/api/projects?status=active")
      .then((r) => setProjects(r.items))
      .catch(() => setProjects([]));
  }, [open]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写产品名称");

    const payload = {
      name: name.trim(),
      status,
      capacity,
      projectId: projectId === NONE ? null : Number(projectId),
      notes,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/products/${initial.id}`, payload)
            : api.post("/api/products", payload),
        { success: initial ? "已保存" : "已创建", error: "保存失败" },
      );
      if (ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑产品" : "新增产品"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="产品名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="产品名称" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="当前状态" hint="自由填写，如：稳定供货 / 上游限速中">
              <Input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="稳定供货"
              />
            </Field>
            <Field label="产能" hint="自由填写，可留空">
              <Input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="日均 200 个"
              />
            </Field>
          </div>

          <Field label="归属项目" hint="留空表示通用产品，不绑定任何项目">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="通用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>通用（不绑定项目）</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="备注">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
