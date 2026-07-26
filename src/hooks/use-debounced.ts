"use client";
import { useEffect, useState } from "react";

/// 搜索框防抖 —— 不加的话每敲一个字打一次接口。
export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
