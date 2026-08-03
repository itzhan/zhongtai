import type { ProjectStatus } from "@/lib/enums";

export interface Project {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  ownerId: number | null;
  ownerName: string;
  description: string;
  /// 可选模块
  enableDemands: boolean;
  enableBatches: boolean;
  startedAt: string;
  owner: { id: number; displayName: string } | null;
  _count: { desks: number; products: number; purchases: number };
}

export interface UserOption {
  id: number;
  displayName: string;
  role: string;
}
