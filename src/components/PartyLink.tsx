"use client";
import Link from "next/link";
import { partyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function partyHref(kind?: string | null, id?: number | null) {
  if (!id) return null;
  if (kind === "member") return `/members/${id}`;
  if (kind === "partner") return `/partners/${id}`;
  return null;
}

export default function PartyLink({
  kind,
  id,
  name,
  className,
}: {
  kind?: string | null;
  id?: number | null;
  name?: string | null;
  className?: string;
}) {
  const label = partyLabel(kind ?? "", name ?? "");
  const href = partyHref(kind, id);
  if (label === "-") return <span className={cn("text-muted-foreground", className)}>-</span>;
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={cn("hover:text-primary", className)} onClick={(e) => e.stopPropagation()}>
      {label}
    </Link>
  );
}
