"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/RoleProvider";
import { useUserOptions } from "@/hooks/use-options";
import { api, mutate } from "@/lib/api-client";
import { PARTNER_STATUS, PARTNER_STATUS_LABEL, type PartnerStatus } from "@/lib/enums";
import { ROLES } from "@/lib/rbac";
import type { Customer } from "./types";

export default function CustomerDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Customer | null;
  onSaved: (id?: number) => void;
}) {
  const session = useSession();
  const canAssign = session.role !== ROLES.SALES;
  const users = useUserOptions(undefined, open && canAssign);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<PartnerStatus>("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setOwnerId(initial?.ownerId ? String(initial.ownerId) : String(session.id));
    setOwnerName(initial?.ownerName || initial?.owner?.displayName || session.displayName);
    setContact(initial?.contact ?? "");
    setStatus(initial?.status ?? "active");
    setNotes(initial?.notes ?? "");
  }, [open, initial, session.id, session.displayName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑客户" : "新增客户"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="客户名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="客户名 / 代号" />
          </Field>
          {canAssign ? (
            <Field label="归属人" required>
              <Select
                value={ownerId}
                onValueChange={(v) => {
                  setOwnerId(v);
                  const u = users.find((x) => String(x.id) === v);
                  if (u) setOwnerName(u.displayName);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择归属人" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="归属人">
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </Field>
          )}
          <Field label="联系方式">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="TG / 微信 / 邮箱" />
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
          <Field label="备注">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!name.trim()) return toast.warning("请填写客户名称");
              setSaving(true);
              const payload = {
                name: name.trim(),
                ownerName: ownerName.trim(),
                contact: contact.trim(),
                status,
                notes: notes.trim(),
                ...(canAssign && ownerId ? { ownerId: Number(ownerId) } : {}),
              };
              const res = await mutate(
                () =>
                  initial
                    ? api.patch<{ item: Customer }>(`/api/customers/${initial.id}`, payload)
                    : api.post<{ item: Customer }>("/api/customers", payload),
                { success: initial ? "已保存" : "已新增", error: "保存失败" },
              );
              setSaving(false);
              if (res) {
                onOpenChange(false);
                onSaved(res.item.id);
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
