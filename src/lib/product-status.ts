// 产品状态是【自由文本】(需求明确要求), 但纯文本在卡片网格里视觉重量
// 不够 —— 一眼扫不出哪个产品出了问题, 而那正是产品卡片的核心用途。
//
// 所以用一张小关键词表推导 Badge 颜色, 拿到大部分收益; 推导不出就回落
// 中性灰, 保证任何文本都长得像有意为之, 不会出现「未知状态一片刺眼的红」。

export type StatusVariant = "success" | "warning" | "destructive" | "secondary";

/// 顺序有意义: 「不可用」必须先于「可用」匹配, 所以 destructive 放最前。
const RULES: [RegExp, StatusVariant][] = [
  [/停|断货|缺货|下架|故障|不可用|封|挂|死/, "destructive"],
  [/紧张|限量|排队|缓慢|部分|测试|待|观察/, "warning"],
  [/正常|稳定|充足|在售|可用|良好|畅通/, "success"],
];

export function statusVariant(s: string | null | undefined): StatusVariant {
  if (!s?.trim()) return "secondary";
  return RULES.find(([re]) => re.test(s))?.[1] ?? "secondary";
}
