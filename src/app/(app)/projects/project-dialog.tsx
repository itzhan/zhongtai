"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Project } from "./types";

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
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [enableDemands, setEnableDemands] = useState(false);
  const [enableBatches, setEnableBatches] = useState(false);
  const [saving, setSaving] = useState(false);

  // 每次打开都从 initial 重新灌一遍, 避免上一次编辑的残留
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setStatus(initial?.status ?? "active");
    setOwnerName(initial?.ownerName || initial?.owner?.displayName || "");
    setDescription(initial?.description ?? "");
    setEnableDemands(Boolean(initial?.enableDemands));
    setEnableBatches(Boolean(initial?.enableBatches));
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写项目名称");

    const payload = {
      name: name.trim(),
      status,
      ownerName: ownerName.trim(),
      description,
      enableDemands,
      enableBatches,
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
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="填写负责人"
              />
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

          <Field label="可选模块" hint="成本/收入与台子默认展示；以下模块按需开启">
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={enableDemands}
                  onCheckedChange={(v) => setEnableDemands(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">甲方需求清单</span>
                  <span className="block text-xs text-muted-foreground">
                    维护本项目甲方需要什么货
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={enableBatches}
                  onCheckedChange={(v) => setEnableBatches(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">产出批次</span>
                  <span className="block text-xs text-muted-foreground">
                    展示本项目的生产产出批次
                  </span>
                </span>
              </label>
            </div>
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
