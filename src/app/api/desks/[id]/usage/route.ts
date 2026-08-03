import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, notFound, parseId, requireRole } from "@/lib/guard";
import { DESK_API_KIND, isOneOf } from "@/lib/enums";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 台子消耗占位接口。按 apiKind 分支, 真实 newapi/sub2api 协议后续接入。
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const desk = await prisma.desk.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      ownerId: true,
      baseUrl: true,
      apiKind: true,
      apiToken: true,
    },
  });
  if (!desk) return notFound("台子不存在");
  if (g.session.role === ROLES.SALES && desk.ownerId !== g.session.id) {
    return forbidden("无权查看他人的台子");
  }

  const apiKind = isOneOf(DESK_API_KIND, desk.apiKind) ? desk.apiKind : "none";

  if (apiKind === "none") {
    return NextResponse.json({
      item: {
        deskId: desk.id,
        apiKind,
        placeholder: true,
        usedUsd: null as number | null,
        message: "未配置 API 对接",
      },
    });
  }

  // ── 真实调用入口（待接入）────────────────────────────────
  // newapi  → 根据 desk.baseUrl + desk.apiToken 拉用量
  // sub2api → 同上, 协议不同
  // 本期统一返回占位数据, 前端可展示「待接入」。
  void desk.baseUrl;
  void desk.apiToken;

  return NextResponse.json({
    item: {
      deskId: desk.id,
      apiKind,
      placeholder: true,
      usedUsd: 0,
      currency: "USD",
      message: `${apiKind === "newapi" ? "NewAPI" : "Sub2API"} 消耗接口待接入`,
    },
  });
}
