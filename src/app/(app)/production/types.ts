import type { RequestStatus, ResourceKind } from "@/lib/enums";

export interface ProductionBatch {
  id: number;
  projectId: number;
  productId: number;
  quantity: number;
  batchDate: string;
  operatorId: number;
  note: string;
  product: { id: number; name: string };
  project: { id: number; code: string; name: string };
  operator: { id: number; displayName: string };
}

export interface RequestItem {
  id: number;
  kind: ResourceKind;
  sourceId: number | null;
  quantity: number;
  /// 脱敏字段: 销售看不到
  amount: number | null;
  note: string;
  source: { id: number; name: string } | null;
}

export interface ResourceRequest {
  id: number;
  projectId: number;
  reporterId: number;
  periodDate: string;
  status: RequestStatus;
  note: string;
  handledAt: string | null;
  items: RequestItem[];
  project: { id: number; code: string; name: string };
  reporter: { id: number; displayName: string };
  handledBy: { id: number; displayName: string } | null;
  purchases: { id: number; totalAmount: number | null }[];
}
