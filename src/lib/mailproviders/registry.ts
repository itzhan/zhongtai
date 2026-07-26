import type { MailProvider } from "./types";

/// provider 注册表。本文件不依赖任何具体 provider —— 依赖方向是
/// provider → registry, 所以加新 provider 不会改到这里。
const registry = new Map<string, MailProvider>();

export function registerProvider(p: MailProvider) {
  if (registry.has(p.key)) {
    throw new Error(`接码插件 "${p.key}" 已注册, key 冲突`);
  }
  registry.set(p.key, p);
}

export function getProvider(key: string): MailProvider | null {
  return registry.get(key) ?? null;
}

export function listProviders(): MailProvider[] {
  return [...registry.values()];
}
