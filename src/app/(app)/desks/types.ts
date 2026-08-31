import type { DeskApiKind, PartnerStatus, SupplierCategory } from "@/lib/enums";

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
  ownerName: string;
  contact: string;
  baseUrl: string;
  apiKind: DeskApiKind | string;
  apiToken: string | null;
  demand: string;
  status: PartnerStatus;
  notes: string;
  items: PartnerItem[];
  owner: { id: number; displayName: string } | null;
  projects: { projectId: number; project: { id: number; code: string; name: string } }[];
}

export interface SupplierEntry {
  id: number;
  amount: number | null;
  note: string;
  entryDate: string;
  creatorName: string;
  project: { id: number; code: string; name: string } | null;
  createdBy: { id: number; displayName: string } | null;
}

export interface SupplierGood {
  id: number;
  name: string;
  rate: string;
}

export interface SupplierComment {
  id: number;
  content: string;
  creatorName: string;
  createdAt: string;
  createdBy: { id: number; displayName: string } | null;
}

export interface Supplier {
  id: number;
  name: string;
  wechat: string;
  contact: string;
  baseUrl: string;
  goods: string;
  category: SupplierCategory | string;
  ownerId: number | null;
  spent?: number;
  goodsItems?: SupplierGood[];
  comments?: SupplierComment[];
  entries?: SupplierEntry[];
  owner: { id: number; displayName: string } | null;
}
