export default function PurposeCell({ text }: { text?: string | null }) {
  const value = (text ?? "").trim();
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <p className="max-w-sm text-[13px] leading-6 text-foreground/90 whitespace-pre-wrap break-words">
      {value}
    </p>
  );
}
