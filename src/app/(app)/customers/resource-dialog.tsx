"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCan } from "@/components/RoleProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, mutate } from "@/lib/api-client";
import {
  COST_MODE,
  COST_MODE_LABEL,
  CUSTOMER_PLATFORM,
  CUSTOMER_PLATFORM_LABEL,
  SELL_MODE,
  SELL_MODE_LABEL,
  type CostMode,
  type SellMode,
} from "@/lib/enums";
import { USDT_CNY_RATE } from "@/lib/format";
import type { CustomerResource } from "./types";

export default function ResourceDialog({
  open,
  onOpenChange,
  customerId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: number;
  initial: CustomerResource | null;
  onSaved: () => void;
}) {
  const canCost = useCan()("cost");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("none");
  const [sellMode, setSellMode] = useState<SellMode>("discount");
  const [zhe, setZhe] = useState("10");
  const [fxRate, setFxRate] = useState(String(USDT_CNY_RATE));
  const [sellUnitPrice, setSellUnitPrice] = useState("");
  const [costMode, setCostMode] = useState<CostMode>("api");
  const [costFixedAmount, setCostFixedAmount] = useState("");
  const [costUnitPrice, setCostUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setPlatform(initial?.platform || "none");
    setSellMode((initial?.sellMode as SellMode) || "discount");
    setZhe(initial?.discount != null ? String(Number((initial.discount * 10).toFixed(4))) : "10");
    setFxRate(initial?.fxRate != null ? String(initial.fxRate) : String(USDT_CNY_RATE));
    setSellUnitPrice(initial?.sellUnitPrice != null && initial.sellUnitPrice !== 0 ? String(initial.sellUnitPrice) : "");
    setCostMode((initial?.costMode as CostMode) || "api");
    setCostFixedAmount(
      initial?.costFixedAmount != null && initial.costFixedAmount !== 0 ? String(initial.costFixedAmount) : "",
    );
    setCostUnitPrice(initial?.costUnitPrice != null && initial.costUnitPrice !== 0 ? String(initial.costUnitPrice) : "");
    setNote(initial?.note ?? "");
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑资源" : "添加资源"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="资源名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 GPT / Claude" />
          </Field>
          <Field label="对应平台" hint="绑了 sub2 用户后按平台拆消耗；不限则整笔算到这一条">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不限</SelectItem>
                {CUSTOMER_PLATFORM.map((p) => (
                  <SelectItem key={p} value={p}>
                    {CUSTOMER_PLATFORM_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="卖价类型">
            <Tabs value={sellMode} onValueChange={(v) => setSellMode(v as SellMode)}>
              <TabsList className="w-full">
                {SELL_MODE.map((m) => (
                  <TabsTrigger key={m} value={m} className="flex-1">
                    {SELL_MODE_LABEL[m]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Field>
          {sellMode === "discount" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="折扣（折）" required hint="4 折填 4，原价填 10">
                <Input type="number" min={0} max={10} step="0.1" value={zhe} onChange={(e) => setZhe(e.target.value)} />
              </Field>
              <Field label="汇率" hint={`收入 = 消耗 × 汇率 × 折扣`}>
                <Input type="number" min={0} step="0.01" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
              </Field>
            </div>
          ) : (
            <Field label="卖价单价" required hint="每 1 美元消耗卖多少人民币">
              <Input type="number" min={0} step="0.01" value={sellUnitPrice} onChange={(e) => setSellUnitPrice(e.target.value)} />
            </Field>
          )}
          {canCost && (
            <>
              <Field label="成本类型">
                <Tabs value={costMode} onValueChange={(v) => setCostMode(v as CostMode)}>
                  <TabsList className="w-full">
                    {COST_MODE.map((m) => (
                      <TabsTrigger key={m} value={m} className="flex-1">
                        {COST_MODE_LABEL[m]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Field>
              {costMode === "fixed" ? (
                <Field label="固定成本" hint="人民币定额，不随消耗变化">
                  <Input type="number" min={0} step="0.01" value={costFixedAmount} onChange={(e) => setCostFixedAmount(e.target.value)} />
                </Field>
              ) : (
                <Field label="成本单价" hint="每 1 美元消耗对应的人民币成本">
                  <Input type="number" min={0} step="0.01" value={costUnitPrice} onChange={(e) => setCostUnitPrice(e.target.value)} />
                </Field>
              )}
            </>
          )}
          <Field label="备注">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!name.trim()) return toast.warning("请填写资源名称");
              const payload: Record<string, unknown> = {
                name: name.trim(),
                platform: platform === "none" ? "" : platform,
                sellMode,
                note: note.trim(),
              };
              if (sellMode === "discount") {
                const z = Number(zhe);
                if (!Number.isFinite(z) || z < 0 || z > 10) return toast.warning("折扣请填 0-10 折");
                payload.zhe = z;
                const fx = Number(fxRate);
                if (!Number.isFinite(fx) || fx <= 0) return toast.warning("汇率非法");
                payload.fxRate = fx;
              } else {
                const p = Number(sellUnitPrice);
                if (!Number.isFinite(p) || p < 0) return toast.warning("卖价单价非法");
                payload.sellUnitPrice = p;
              }
              if (canCost) {
                payload.costMode = costMode;
                if (costMode === "fixed") {
                  const n = Number(costFixedAmount || 0);
                  if (!Number.isFinite(n) || n < 0) return toast.warning("固定成本非法");
                  payload.costFixedAmount = n;
                } else {
                  const n = Number(costUnitPrice || 0);
                  if (!Number.isFinite(n) || n < 0) return toast.warning("成本单价非法");
                  payload.costUnitPrice = n;
                }
              }
              setSaving(true);
              const ok = await mutate(
                () =>
                  initial
                    ? api.patch(`/api/customers/${customerId}/resources/${initial.id}`, payload)
                    : api.post(`/api/customers/${customerId}/resources`, payload),
                { success: initial ? "已保存" : "已添加", error: "保存失败" },
              );
              setSaving(false);
              if (ok) {
                onOpenChange(false);
                onSaved();
              }
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
