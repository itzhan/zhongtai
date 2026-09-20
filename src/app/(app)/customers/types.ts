import type { CostMode, PartnerStatus, SellMode } from "@/lib/enums";

export interface CustomerResource {
  id: number;
  name: string;
  platform: string;
  sellMode: SellMode | string;
  discount: number | null;
  fxRate: number | null;
  sellUnitPrice: number | null;
  costMode: CostMode | string;
  costFixedAmount: number | null;
  costUnitPrice: number | null;
  note: string;
  sortOrder: number;
}

export interface Customer {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  contact: string;
  status: PartnerStatus;
  notes: string;
  sub2SiteId: number | null;
  sub2UserId: number | null;
  sub2UserName: string;
  sub2UserEmail: string;
  owner: { id: number; displayName: string } | null;
  sub2Site: { id: number; name: string; baseUrl: string } | null;
  resources: CustomerResource[];
}

export interface CustomerUsageLine {
  id: number;
  name: string;
  platform: string;
  usageUsd: number;
  income: number;
  cost: number | null;
  profit: number | null;
}

export interface CustomerUsage {
  period: string;
  start: string;
  end: string;
  bound: boolean;
  message?: string;
  usageUsd: number;
  actualCostUsd?: number | null;
  accountCostUsd?: number | null;
  totalRequests?: number;
  totalTokens?: number;
  income: number;
  cost: number | null;
  profit: number | null;
  resources: CustomerUsageLine[];
}

export interface SiteOption {
  id: number;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
}

export interface Sub2UserOption {
  id: number;
  email: string;
  username: string;
  name: string;
  status: string;
}
