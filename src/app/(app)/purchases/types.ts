import type { PurchaseKind } from "@/lib/enums";

export interface Purchase {
  id: number;
  projectId: number | null;
  requestId: number | null;
  kind: PurchaseKind;
  purchaserId: number;
  purchaserName: string;
  sourceId: number | null;
  content: string;
  /// 脱敏字段: 销售/生产看不到
  detail: string | null;
  quantity: number;
  /// 脱敏字段
  totalAmount: number | null;
  purchaseDate: string;
  notes: string;
  project: { id: number; code: string; name: string } | null;
  purchaser: { id: number; displayName: string };
  source: { id: number; name: string } | null;
}
