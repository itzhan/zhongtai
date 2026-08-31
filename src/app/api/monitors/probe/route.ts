import { requireRoleFresh } from "@/lib/guard";
import { jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";
import { runEnabledMonitors } from "@/lib/supplier-probe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const g = await requireRoleFresh(ROLES.RESOURCE, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const results = await runEnabledMonitors();
  return jsonItems("supplierMonitor", g.session.role, results);
}
