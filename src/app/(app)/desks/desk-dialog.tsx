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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DESK_API_KIND,
  DESK_API_KIND_LABEL,
  PARTNER_STATUS,
  PARTNER_STATUS_LABEL,
  type DeskApiKind,
  type PartnerStatus,
} from "@/lib/enums";
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
  const [name, setName] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKind, setApiKind] = useState<DeskApiKind>("none");
  const [apiToken, setApiToken] = useState("");
  const [demand, setDemand] = useState("");
  const [status, setStatus] = useState<PartnerStatus>("active");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GoodsLine[]>([]);
  const [saving, setSaving] = useState(false);

  const projects = useProjectOptions(open);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setProjectIds((initial?.projects ?? []).map((item) => String(item.project.id)));
    setOwnerName(initial?.ownerName || initial?.owner?.displayName || "");
    setBaseUrl(initial?.baseUrl ?? "");
    setApiKind(
      (DESK_API_KIND.includes(initial?.apiKind as DeskApiKind)
        ? initial?.apiKind
        : "none") as DeskApiKind,
    );
    setApiToken(initial?.apiToken ?? "");
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
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return toast.warning("请填写需求名称");

    const bad = lines.findIndex((l) => !l.productName.trim());
    if (bad >= 0) return toast.warning(`第 ${bad + 1} 行未填写产品`);

    const payload = {
      name: name.trim(),
      projectIds: projectIds.map(Number),
      ownerName: ownerName.trim(),
      baseUrl: baseUrl.trim(),
      apiKind,
      apiToken,
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
          <DialogTitle>{initial ? "编辑需求" : "新增需求"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="需求名称" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="客户代号 / 需求名"
              />
            </Field>
            <Field label="归属销售" hint="随便填，不需要是系统账号">
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="销售名字"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="所属项目" hint="可同时挂多个项目">
              <div className="max-h-36 overflow-y-auto rounded-md border border-border p-2 space-y-1.5">
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无项目</p>
                ) : (
                  projects.map((p) => {
                    const value = String(p.id);
                    const checked = projectIds.includes(value);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setProjectIds((prev) =>
                              v === true ? [...prev, value] : prev.filter((id) => id !== value),
                            )
                          }
                        />
                        {p.name}
                      </label>
                    );
                  })
                )}
              </div>
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
            <Field label="Base URL">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="API 类型" hint="按类型拉取消耗，协议待接入">
              <Select value={apiKind} onValueChange={(v) => setApiKind(v as DeskApiKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESK_API_KIND.map((k) => (
                    <SelectItem key={k} value={k}>
                      {DESK_API_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="API Token" hint={apiKind === "none" ? "不对接时可不填" : undefined}>
              <Input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="接口凭证"
                autoComplete="off"
              />
            </Field>
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
