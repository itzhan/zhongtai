"use client";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARTY_KIND, PARTY_KIND_LABEL, type PartyKind } from "@/lib/enums";

export interface PartyOption {
  id: number;
  name: string;
}

export default function PartyPicker({
  label,
  kind,
  id,
  members,
  partners,
  onChange,
}: {
  label?: string;
  kind: string;
  id: number | null;
  members: PartyOption[];
  partners: PartyOption[];
  onChange: (kind: PartyKind, id: number | null) => void;
}) {
  const currentKind: PartyKind = kind === "partner" ? "partner" : "member";
  const list = currentKind === "member" ? members : partners;
  const value = id ? String(id) : "";
  const controls = (
      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <Select
          value={currentKind}
          onValueChange={(v) => onChange(v as PartyKind, null)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_KIND.map((k) => (
              <SelectItem key={k} value={k}>
                {PARTY_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value || undefined} onValueChange={(v) => onChange(currentKind, Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder={currentKind === "member" ? "选择成员" : "选择伙伴"} />
          </SelectTrigger>
          <SelectContent>
            {list.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                #{p.id} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
  );
  if (!label) return controls;
  return (
    <Field label={label} required>
      {controls}
    </Field>
  );
}
