import { goodsKeyword, parseRateLowerBound, type MonitorKind } from "./enums";

export function goodsForKind(kind: MonitorKind, goods: { id: number; name: string; rate: string }[]) {
  const cat = kind === "claude" ? "claude" : "gpt";
  const matched = goods.filter((good) => goodsKeyword(good.name) === cat);
  const list = matched.length ? matched : goods;
  return list.filter((good) => good.rate);
}

export function rateForKind(kind: MonitorKind, goods: { id: number; name: string; rate: string }[]): number | null {
  const nums = goodsForKind(kind, goods)
    .map((good) => parseRateLowerBound(good.rate))
    .filter((n): n is number => n != null);
  return nums.length ? Math.min(...nums) : null;
}
