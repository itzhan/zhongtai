import { NextResponse } from "next/server";
import { requireRole } from "@/lib/guard";
import { actionsForRole } from "@/lib/ai-actions";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireRole(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const items = actionsForRole(g.session.role as Role).map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    template: a.template,
  }));

  return NextResponse.json({ items });
}
