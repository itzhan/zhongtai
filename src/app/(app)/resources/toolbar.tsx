"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/// 四个资源子页共用的工具条布局: 左侧搜索 + 筛选, 右侧操作按钮。
export default function ResourceToolbar({
  q,
  onQ,
  placeholder,
  filters,
  actions,
}: {
  q: string;
  onQ: (v: string) => void;
  placeholder: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          className="pl-8 w-56"
          placeholder={placeholder}
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </div>
      {filters}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </div>
  );
}
