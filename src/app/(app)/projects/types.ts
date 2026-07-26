import type { ProjectStatus } from "@/lib/enums";

export interface Project {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  ownerId: number | null;
  description: string;
  startedAt: string;
  owner: { id: number; displayName: string } | null;
  _count: { desks: number; products: number; purchases: number };
}

export interface UserOption {
  id: number;
  displayName: string;
  role: string;
}
