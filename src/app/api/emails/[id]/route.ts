import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { isOneOf, RESOURCE_STATUS } from "@/lib/enums";
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

  const existing = await prisma.emailResource.findUnique({ where: { id } });
  if (!existing) return notFound("邮箱不存在");

  const body = (await req.json().catch(() => ({}))) as Partial<{
    address: string;
    password: string;
    providerKey: string;
    recoveryInfo: string;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
  }>;

  const data: Record<string, unknown> = {};
  if (body.address !== undefined) {
    const v = body.address.trim();
    if (!v) return badRequest("邮箱地址不能为空");
    if (v !== existing.address) {
      const dup = await prisma.emailResource.findUnique({ where: { address: v } });
      if (dup) return NextResponse.json({ error: "该邮箱已存在" }, { status: 409 });
    }
    data.address = v;
  }
  if (body.password !== undefined) data.password = body.password;
  if (body.providerKey !== undefined) data.providerKey = body.providerKey;
  if (body.recoveryInfo !== undefined) data.recoveryInfo = body.recoveryInfo;
  if (body.sourceId !== undefined) data.sourceId = body.sourceId ?? null;
  if (body.projectId !== undefined) data.projectId = body.projectId ?? null;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.status !== undefined) {
    if (!isOneOf(RESOURCE_STATUS, body.status)) return badRequest("状态非法");
    data.status = body.status;
  }

  const item = await prisma.emailResource.update({ where: { id }, data, include: INCLUDE });
  return jsonItem("email", g.session.role, item);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.emailResource.findUnique({ where: { id } });
  if (!existing) return notFound("邮箱不存在");

  await prisma.emailResource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
