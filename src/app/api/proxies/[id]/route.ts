import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { isOneOf, PROXY_IP_TYPE, PROXY_PROTOCOL, RESOURCE_STATUS } from "@/lib/enums";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  source: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.proxyResource.findUnique({ where: { id } });
  if (!existing) return notFound("代理不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    protocol: string;
    ipType: string;
    host: string;
    port: number;
    username: string;
    password: string;
    region: string;
    rotateUrl: string;
    expiresAt: string | null;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.host !== undefined) {
    const v = body.host.trim();
    if (!v) return badRequest("地址不能为空");
    data.host = v;
  }
  if (body.port !== undefined) {
    const p = Number(body.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return badRequest("端口非法");
    data.port = p;
  }
  if (body.protocol !== undefined) {
    if (!isOneOf(PROXY_PROTOCOL, body.protocol)) return badRequest("网络类型非法");
    data.protocol = body.protocol;
  }
  if (body.ipType !== undefined) {
    if (!isOneOf(PROXY_IP_TYPE, body.ipType)) return badRequest("IP 类型非法");
    data.ipType = body.ipType;
    // 切回静态就清掉换 IP 接口, 避免留下误导性的残值
    if (body.ipType === "static") data.rotateUrl = "";
  }
  if (body.rotateUrl !== undefined && data.rotateUrl === undefined) {
    const nextType = (data.ipType as string) ?? existing.ipType;
    data.rotateUrl = nextType === "dynamic" ? body.rotateUrl : "";
  }
  if (body.username !== undefined) data.username = body.username;
  if (body.password !== undefined) data.password = body.password;
  if (body.region !== undefined) data.region = body.region;
  if (body.sourceId !== undefined) data.sourceId = body.sourceId ?? null;
  if (body.projectId !== undefined) data.projectId = body.projectId ?? null;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.status !== undefined) {
    if (!isOneOf(RESOURCE_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }

  const item = await prisma.proxyResource.update({ where: { id }, data, include: INCLUDE });
  return jsonItem("proxy", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.proxyResource.findUnique({ where: { id } });
  if (!existing) return notFound("代理不存在");

  await prisma.proxyResource.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
