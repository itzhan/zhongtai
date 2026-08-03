export interface Purchase {
  id: number;
  projectId: number | null;
  requestId: number | null;
  kind: string;
  purchaserId: number;
  purchaserName: string;
  sourceId: number | null;
  content: string;
  detail: string | null;
  quantity: number;
  totalAmount: number | null;
  purchaseDate: string;
  notes: string;
  project: { id: number; code: string; name: string } | null;
  purchaser: { id: number; displayName: string };
  source: { id: number; name: string } | null;
  /// 成本流水原生字段
  entryKind?: "cost";
  amount?: number | null;
  note?: string;
  entryDate?: string;
}
