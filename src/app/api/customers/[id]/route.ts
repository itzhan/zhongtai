import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CUSTOMER_INCLUDE, canSeeCustomer, parseBinding, parseStatus } from "@/lib/customer";
import { badRequest, forbidden, notFound, parseId, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem } from "@/lib/mask";
import { ROLES, type Role } from "@/lib/rbac";

export const runtime = "nodejs";

async function loadOwned(id: number, role: Role, sessionId: number) {
  const item = await prisma.customer.findUnique({ where: { id }, include: CUSTOMER_INCLUDE });
  if (!item) return { error: "notfound" as const };
  if (!canSeeCustomer(role, item.ownerId, sessionId)) return { error: "forbidden" as const };
  return { item };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const loaded = await loadOwned(id, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("客户不存在") : forbidden("无权查看他人的客户");
  return jsonItem("customer", g.session.role, loaded.item);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const loaded = await loadOwned(id, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("客户不存在") : forbidden("无权修改他人的客户");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest("客户名称不能为空");
    data.name = name;
  }
  if (body.ownerName !== undefined) data.ownerName = String(body.ownerName).trim();
  if (body.contact !== undefined) data.contact = String(body.contact);
  if (body.notes !== undefined) data.notes = String(body.notes);
  const status = parseStatus(body.status);
  if (status && typeof status === "object") return badRequest(status.error);
  if (typeof status === "string") data.status = status;

  if (body.ownerId !== undefined) {
    if (g.session.role === ROLES.SALES) return forbidden("不能转给他人");
    const n = Number(body.ownerId);
    if (!Number.isInteger(n) || n <= 0) return badRequest("归属人不合法");
    const owner = await prisma.user.findUnique({ where: { id: n }, select: { id: true } });
    if (!owner) return badRequest("归属人不存在");
    data.ownerId = n;
  }

  const binding = parseBinding({
    sub2SiteId: body.sub2SiteId as number | null | undefined,
    sub2UserId: body.sub2UserId as number | null | undefined,
    sub2UserName: body.sub2UserName as string | undefined,
    sub2UserEmail: body.sub2UserEmail as string | undefined,
  });
  if ("error" in binding) return badRequest(binding.error);
  if (!("skip" in binding)) {
    if (binding.sub2SiteId) {
      const site = await prisma.sub2Site.findUnique({ where: { id: binding.sub2SiteId }, select: { id: true } });
      if (!site) return badRequest("中台不存在");
      const clash = await prisma.customer.findFirst({
        where: {
          sub2SiteId: binding.sub2SiteId,
          sub2UserId: binding.sub2UserId,
          id: { not: id },
        },
        select: { id: true, name: true },
      });
      if (clash) return badRequest(`该 sub2 用户已绑定客户「${clash.name}」`);
    }
    data.sub2SiteId = binding.sub2SiteId;
    data.sub2UserId = binding.sub2UserId;
    data.sub2UserName = binding.sub2UserName;
    data.sub2UserEmail = binding.sub2UserEmail;
  }

  try {
    const item = await prisma.customer.update({ where: { id }, data, include: CUSTOMER_INCLUDE });
    return jsonItem("customer", g.session.role, item);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return badRequest("该 sub2 用户已绑定其他客户");
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");
  const loaded = await loadOwned(id, g.session.role, g.session.id);
  if ("error" in loaded) return loaded.error === "notfound" ? notFound("客户不存在") : forbidden("无权删除他人的客户");
  await prisma.customer.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      sub2SiteId: null,
      sub2UserId: null,
      sub2UserName: "",
      sub2UserEmail: "",
    },
  });
  return NextResponse.json({ ok: true });
}
