"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";

/// 敏感字段单元格: 默认掩码, 点眼睛看明文, 点复制按钮拷走。
/// value 为 null 表示当前角色被 API 脱敏了 —— 显示成 ··· 而不是空白,
/// 让人知道"这里有值但你看不到"。
export default function SecretCell({
  value,
  mask = (v) => "•".repeat(Math.min(v.length, 8)),
  mono = true,
}: {
  value: string | null;
  mask?: (v: string) => string;
  mono?: boolean;
}) {
  const [shown, setShown] = useState(false);

  if (value === null) {
    return <span className="text-muted-foreground/50" title="无权查看">···</span>;
  }
  if (!value) return <span className="text-muted-foreground/50">-</span>;

  return (
    <span className="inline-flex items-center gap-1">
      <span className={mono ? "font-mono text-xs" : "text-xs"}>
        {shown ? value : mask(value)}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground"
        aria-label={shown ? "隐藏" : "显示"}
        onClick={() => setShown(!shown)}
      >
        {shown ? <EyeOff size={12} /> : <Eye size={12} />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground"
        aria-label="复制"
        onClick={async () => {
          const ok = await copyToClipboard(value);
          if (ok) toast.success("已复制");
          else toast.error("复制失败");
        }}
      >
        <Copy size={12} />
      </Button>
    </span>
  );
}

/// 卡号专用掩码: 只留后 4 位。
export const maskCardNo = (v: string) =>
  v.length <= 4 ? v : `**** ${v.slice(-4)}`;
