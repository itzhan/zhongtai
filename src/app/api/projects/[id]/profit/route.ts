import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseId, requireRole } from "@/lib/guard";
import { projectDailyProfit, projectProfit } from "@/lib/profit";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

/// 项目维度的收入/成本/利润 + 逐日序列。只有财务与管理员能读。
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRole(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return notFound("项目不存在");

  const days = Math.min(
    Math.max(Number(new URL(req.url).searchParams.get("days")) || 30, 7),
    90,
  );

  const [summary, daily] = await Promise.all([projectProfit(id), projectDailyProfit(id, days)]);

  return NextResponse.json({
    item: {
      ...summary,
      daily,
    },
  });
}
