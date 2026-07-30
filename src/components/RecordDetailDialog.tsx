"use client";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export interface DetailField { label: string; value: ReactNode; wide?: boolean }

export default function RecordDetailDialog({ open, onOpenChange, title, fields }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; fields: DetailField[] }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{fields.map((field, index) => <div key={`${field.label}-${index}`} className={field.wide ? "sm:col-span-2" : undefined}><p className="text-xs text-muted-foreground">{field.label}</p><div className="mt-1 break-words text-sm font-medium whitespace-pre-wrap">{field.value || "-"}</div></div>)}</div></DialogContent></Dialog>;
}
