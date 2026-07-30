"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import GoodsLines, { type GoodsLine } from "@/components/GoodsLines";
import { useSession } from "@/components/RoleProvider";
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
import { useProjectOptions, useUserOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PARTNER_STATUS, PARTNER_STATUS_LABEL, type PartnerStatus } from "@/lib/enums";
import { ROLES } from "@/lib/rbac";
import type { Desk } from "./types";

export default function DeskDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Desk | null;
  onSaved: () => void;
}) {
  const session = useSession();
  const isSales = session.role === ROLES.SALES;

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [demand, setDemand] = useState("");
  const [status, setStatus] = useState<PartnerStatus>("active");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GoodsLine[]>([]);
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);
  const sales = useUserOptions(ROLES.SALES, open && !isSales);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setProjectId(initial?.projectId ? String(initial.projectId) : "");
    setOwnerId(String(initial?.ownerId ?? session.id));
    setBaseUrl(initial?.baseUrl ?? "");
    setDemand(initial?.demand ?? "");
    setStatus(initial?.status ?? "active");
    setNotes(initial?.notes ?? "");
    setLines(
      (initial?.items ?? []).map((it) => ({
        key: crypto.randomUUID(),
        productId: it.productId,
        productName: it.productName || it.product.name,
        apiKey: "",
        quantity: 0,
        unitPrice: it.unitPrice ?? 0,
        note: it.note,
      })),
    );
  }, [open, initial, session.id]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写台子名称");
    if (!projectId) return toast.warning("请选择归属项目");

    const bad = lines.findIndex((l) => !l.productName.trim());
    if (bad >= 0) return toast.warning(`第 ${bad + 1} 行未填写产品`);

    const payload = {
      name: name.trim(),
      projectId: Number(projectId),
      ...(isSales ? {} : { ownerId: Number(ownerId) }),
      baseUrl: baseUrl.trim(),
      demand,
      status,
      notes,
      items: lines.map((l) => ({
        productName: l.productName.trim(),
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
            ? api.patch(`/api/desks/${initial.id}`, payload)
            : api.post("/api/desks", payload),
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
          <DialogTitle>{initial ? "编辑台子" : "新增台子"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="台子名称" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="客户代号"
              />
            </Field>
            <Field label="归属销售" required hint={isSales ? "销售只能建自己的台子" : undefined}>
              {isSales ? (
                <Input value={session.displayName} disabled />
              ) : (
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择销售" />
                  </SelectTrigger>
                  <SelectContent>
                    {sales.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
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

          <Field label="需求说明" hint="文字描述，结构化的量价填在下方明细里">
            <Textarea rows={2} value={demand} onChange={(e) => setDemand(e.target.value)} />
          </Field>

          <Separator />

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              货需求明细
            </p>
            <GoodsLines
              value={lines}
              onChange={setLines}
              priceLabel="卖价"
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
