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
import { PROJECT_STATUS, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/enums";
import type { Project, UserOption } from "./types";

const NONE = "none";

export default function ProjectDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Project | null;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [ownerId, setOwnerId] = useState<string>(NONE);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // 每次打开都从 initial 重新灌一遍, 避免上一次编辑的残留
  useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? "");
    setName(initial?.name ?? "");
    setStatus(initial?.status ?? "active");
    setOwnerId(initial?.ownerId ? String(initial.ownerId) : NONE);
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: UserOption[] }>("/api/users/options")
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]));
  }, [open]);

  async function save() {
    if (!code.trim()) return toast.warning("请填写项目代号");
    if (!name.trim()) return toast.warning("请填写项目名称");

    const payload = {
      code: code.trim(),
      name: name.trim(),
      status,
      ownerId: ownerId === NONE ? null : Number(ownerId),
      description,
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/projects/${initial.id}`, payload)
            : api.post("/api/projects", payload),
        { success: initial ? "已保存" : "已立项", error: initial ? "保存失败" : "立项失败" },
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
          <DialogTitle>{initial ? "编辑项目" : "新建项目"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="项目代号" required hint="短标识，如 P-2026-01">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="P-2026-01"
              />
            </Field>
            <Field label="项目名称" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="项目名称"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="状态">
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="负责人">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="未指定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未指定</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="说明">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个项目做什么、对接哪些产品"
            />
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
