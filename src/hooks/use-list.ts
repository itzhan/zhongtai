"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

/// 列表页统一的数据获取。
/// 约定: 所有列表端点都返回 { items: T[] }。
/// 筛选条件用 useMemo 拼进 path 字符串, path 一变 hook 自动重取 ——
/// 不需要额外的 refetch 编排。
export function useList<T>(path: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ items: T[] }>(path);
      setItems(r.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload, setItems };
}
