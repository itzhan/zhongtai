"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface ProjectOption {
  id: number;
  code: string;
  name: string;
}

export interface ProductOption {
  id: number;
  name: string;
}

export interface UserOption {
  id: number;
  displayName: string;
  role: string;
}

/// 各表单共用的下拉选项。enabled=false 时不发请求 (Dialog 关着时不必拉)。
function useOptions<T>(path: string, enabled: boolean): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .get<{ items: T[] }>(path)
      .then((r) => alive && setItems(r.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [path, enabled]);
  return items;
}

export const useProjectOptions = (enabled = true) =>
  useOptions<ProjectOption>("/api/projects", enabled);

export const useProductOptions = (enabled = true) =>
  useOptions<ProductOption>("/api/products", enabled);

export const useUserOptions = (role?: string, enabled = true) =>
  useOptions<UserOption>(
    role ? `/api/users/options?role=${role}` : "/api/users/options",
    enabled,
  );

export interface SourceOption {
  id: number;
  name: string;
  kinds: string;
  /// 脱敏后可能是 null (生产角色看不到价格)
  emailPrice: number | null;
  proxyPrice: number | null;
  cardPrice: number | null;
}

export const useSourceOptions = (enabled = true) =>
  useOptions<SourceOption>("/api/sources", enabled);
