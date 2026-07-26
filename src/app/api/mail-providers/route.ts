import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { listProviders } from "@/lib/mailproviders";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 注册表里的插件 + 数据库里的配置合并后返回。
/// secret 字段的【值】不回传, 只回传"填没填过", 避免密钥经接口外泄。
export async function GET() {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const rows = await prisma.emailProviderConfig.findMany();
  const byKey = new Map(rows.map((r) => [r.providerKey, r]));

  const items = listProviders().map((p) => {
    const row = byKey.get(p.key);
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(row?.configJson ?? "{}");
    } catch {
      config = {};
    }

    return {
      key: p.key,
      label: row?.label || p.label,
      enabled: row?.enabled ?? true,
      configFields: p.configFields,
      config: Object.fromEntries(
        p.configFields.map((f) => [
          f.name,
          f.secret ? (config[f.name] ? "********" : "") : (config[f.name] ?? ""),
        ]),
      ),
    };
  });

  return NextResponse.json({ items });
}
