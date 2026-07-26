// 前端用的字段可见性表 —— 决定"要不要渲染这一列/这个输入框"。
//
// 这【不是安全边界】。真正的脱敏在 src/lib/mask.ts (API 层), 这里只是
// 让界面不出现整列的 "-"。两份表的口径应保持一致。
import { ROLES, type Role } from "./rbac";

const { SALES, PRODUCTION, FINANCE, RESOURCE } = ROLES;

export type FieldKey = "price" | "cost" | "profit" | "secret";

export const FIELDS: Record<FieldKey, readonly Role[]> = {
  /// 台子卖价 / 销售额
  price: [SALES, FINANCE],
  /// 进货价 / 采购金额 / 资源消耗金额
  cost: [RESOURCE, FINANCE],
  /// 利润 / 利润率
  profit: [FINANCE],
  /// 卡号 CVV / 代理与邮箱凭据明文
  secret: [RESOURCE, PRODUCTION],
};
