"use client";
// 统一的 fetch 封装。只做两件事: 统一错误解包 + 统一 toast。
// 刻意不做缓存 / SWR / 拦截器链 —— 页面用 useList 拉列表, 变更后 reload,
// 这套业务不需要更复杂的东西。
import { toast } from "sonner";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // 非 JSON 响应 (例如 Next 的 HTML 错误页), 下面按纯文本处理
  }

  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ??
      (text ? text.slice(0, 200) : `HTTP ${res.status}`);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T,>(path: string) => request<T>("DELETE", path),
};

/// 变更操作统一 toast。失败返回 null (toast 已弹), 调用方据此决定要不要
/// 关闭 Dialog:
///   const ok = await mutate(() => api.post("/api/desks", payload), {...});
///   if (ok) { close(); reload(); }
export async function mutate<T>(
  fn: () => Promise<T>,
  msg: { success?: string; error: string },
): Promise<T | null> {
  try {
    const r = await fn();
    if (msg.success) toast.success(msg.success);
    return r;
  } catch (e) {
    toast.error(msg.error, {
      description: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
