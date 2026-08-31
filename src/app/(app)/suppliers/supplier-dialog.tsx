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
import { api, mutate } from "@/lib/api-client";
import {
  parseSupplierCategories,
  SUPPLIER_CATEGORY,
  SUPPLIER_CATEGORY_LABEL,
  type SupplierCategory,
} from "@/lib/enums";
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
  const [wechat, setWechat] = useState("");
  const [contact, setContact] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [goods, setGoods] = useState("");
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setWechat(initial?.wechat ?? "");
    setContact(initial?.contact ?? "");
    setBaseUrl(initial?.baseUrl ?? "");
    setGoods(initial?.goods ?? "");
    setCategories(parseSupplierCategories(initial?.category));
  }, [open, initial]);

  function toggle(value: SupplierCategory) {
    setCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function save() {
    if (!name.trim()) return toast.warning("请填写供应商名称");
    if (!categories.length) return toast.warning("请选择业务分类");

    const payload = {
      name: name.trim(),
      wechat: wechat.trim(),
      contact: contact.trim(),
      baseUrl: baseUrl.trim(),
      goods: goods.trim(),
      category: categories,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑供应商" : "新增供应商"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="供应商名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="商家 / 中间人" />
          </Field>
          <Field label="业务分类" required hint="可多选">
            <div className="flex flex-wrap gap-4 pt-1">
              {SUPPLIER_CATEGORY.map((value) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={categories.includes(value)} onCheckedChange={() => toggle(value)} />
                  <span className="text-sm">{SUPPLIER_CATEGORY_LABEL[value]}</span>
                </label>
              ))}
            </div>
          </Field>
          {categories.includes("cardshop") ? (
            <>
              <Field label="网站链接" hint="卡网首页或对接地址">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Telegram">
                <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username 或 t.me/..." />
              </Field>
              <Field label="微信号">
                <Input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="微信号" />
              </Field>
              <Field label="可以提供的产品" hint="自由文本，多个用顿号或逗号分开">
                <Input
                  value={goods}
                  onChange={(e) => setGoods(e.target.value)}
                  placeholder="例如：Visa 虚拟卡、充值卡"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="微信号">
                <Input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="微信号" />
              </Field>
              <Field label="可以提供的货" hint="自由文本，多个用顿号或逗号分开">
                <Input
                  value={goods}
                  onChange={(e) => setGoods(e.target.value)}
                  placeholder="例如：Claude 官key、Outlook"
                />
              </Field>
            </>
          )}
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
