import type { DeskApiKind, PartnerStatus } from "@/lib/enums";

export interface PartnerItem {
  id: number;
  productId: number;
  productName: string;
  apiKey?: string;
  quantity: number;
  /// 台子是卖价、供货方是进价。脱敏后可能是 null
  unitPrice: number | null;
  note: string;
  product: { id: number; name: string };
}

export interface Desk {
  id: number;
  name: string;
  ownerId: number;
  projectId: number;
  contact: string;
  baseUrl: string;
  apiKind: DeskApiKind | string;
  apiToken: string | null;
  demand: string;
  status: PartnerStatus;
  notes: string;
  items: PartnerItem[];
  owner: { id: number; displayName: string } | null;
  project: { id: number; code: string; name: string } | null;
}

export interface Supplier {
  id: number;
  name: string;
  ownerId: number | null;
  projectId: number;
  contact: string;
  baseUrl: string;
  channel: string;
  status: PartnerStatus;
  notes: string;
  items: PartnerItem[];
  owner: { id: number; displayName: string } | null;
  project: { id: number; code: string; name: string } | null;
}
