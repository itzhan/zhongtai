"use client";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/// 列表页的加载 / 错误 / 空 三态。每个列表页都套它, 保证三种状态的
/// 呈现全站一致。
export default function DataState({
  loading,
  error,
  empty,
  emptyText = "暂无数据",
  emptyAction,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center px-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-md break-words">{error}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center px-4">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
