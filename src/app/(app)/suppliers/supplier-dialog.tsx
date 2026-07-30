"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import GoodsLines, { type GoodsLine } from "@/components/GoodsLines";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useProjectOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PARTNER_STATUS, PARTNER_STATUS_LABEL, type PartnerStatus } from "@/lib/enums";
import type { Supplier } from "../desks/types";

export default function SupplierDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Supplier | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [status, setStatus] = useState<PartnerStatus>("active");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GoodsLine[]>([]);
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setBaseUrl(initial?.baseUrl ?? "");
    setStatus(initial?.status ?? "active");
    setNotes(initial?.notes ?? "");
    setLines(
      (initial?.items ?? []).map((it) => ({
        key: crypto.randomUUID(),
        productId: it.productId,
        productName: it.productName || it.product.name,
        apiKey: it.apiKey || "",
        quantity: 0,
        unitPrice: it.unitPrice ?? 0,
        note: it.note,
      })),
    );
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写供货方名称");
    if (!projectId) return toast.warning("请选择归属项目");

    const bad = lines.findIndex((l) => !l.productName.trim());
    if (bad >= 0) return toast.warning(`第 ${bad + 1} 行未填写产品`);

    const payload = {
      name: name.trim(),
      projectId: Number(projectId),
      baseUrl: baseUrl.trim(),
      status,
      notes,
      items: lines.map((l) => ({
        productName: l.productName.trim(),
        apiKey: l.apiKey,
        quantity: 0,
        unitPrice: l.unitPrice,
        note: l.note,
      })),
    };

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          initial
            ? api.patch(`/api/suppliers/${initial.id}`, payload)
            : api.post("/api/suppliers", payload),
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑供货方" : "新增供货方"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="供货方名称" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="商家 / 中间人"
              />
            </Field>
            <Field label="归属项目" required>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="状态">
              <Select value={status} onValueChange={(v) => setStatus(v as PartnerStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PARTNER_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Base URL"><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" /></Field>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              能供的货
            </p>
            <GoodsLines
              value={lines}
              onChange={setLines}
              priceLabel="进货价"
              showKey
            />
          </div>

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
