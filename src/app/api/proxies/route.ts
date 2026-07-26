import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PROXY_IP_TYPE, PROXY_PROTOCOL, RESOURCE_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  source: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

/// 生产要用代理去生产, 所以能看到 password; 销售/财务看不到。
export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const protocol = sp.get("protocol");
  const ipType = sp.get("ipType");
  const status = sp.get("status");
  const sourceId = sp.get("sourceId");

  const items = await prisma.proxyResource.findMany({
    where: {
      ...(q ? { OR: [{ host: { contains: q } }, { region: { contains: q } }] } : {}),
      ...(protocol && protocol !== "all" ? { protocol } : {}),
      ...(ipType && ipType !== "all" ? { ipType } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(sourceId && sourceId !== "all" ? { sourceId: Number(sourceId) } : {}),
    },
    include: INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("proxy", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    protocol: string;
    ipType: string;
    host: string;
    port: number;
    username: string;
    password: string;
    region: string;
    rotateUrl: string;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
  }>;

  const host = (body.host ?? "").trim();
  const port = Number(body.port);
  if (!host) return badRequest("请填写地址");
  if (!Number.isInteger(port) || port < 1 || port > 65535) return badRequest("端口非法");
  if (body.protocol !== undefined && !isOneOf(PROXY_PROTOCOL, body.protocol)) {
    return badRequest("网络类型非法");
  }
  if (body.ipType !== undefined && !isOneOf(PROXY_IP_TYPE, body.ipType)) {
    return badRequest("IP 类型非法");
  }
  if (body.status !== undefined && !isOneOf(RESOURCE_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const item = await prisma.proxyResource.create({
    data: {
      protocol: body.protocol ?? "socks",
      ipType: body.ipType ?? "static",
      host,
      port,
      username: body.username ?? "",
      password: body.password ?? "",
      region: body.region ?? "",
      // 换 IP 接口只对动态 IP 有意义
      rotateUrl: body.ipType === "dynamic" ? (body.rotateUrl ?? "") : "",
      status: body.status ?? "available",
      sourceId: body.sourceId ?? null,
      projectId: body.projectId ?? null,
      notes: body.notes ?? "",
    },
    include: INCLUDE,
  });

  return jsonItem("proxy", g.session.role, item);
}
