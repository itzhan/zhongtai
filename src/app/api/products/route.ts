import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireAuth, requireRoleFresh } from "@/lib/guard";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = { project: { select: { id: true, code: true, name: true } } } as const;

/// 产品对所有角色可见 —— 销售明确要看这块。
export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const projectId = sp.get("projectId");

  const items = await prisma.product.findMany({
    where: {
      ...(q ? { name: { contains: q } } : {}),
      ...(projectId && projectId !== "all"
        ? projectId === "none"
          ? { projectId: null }
          : { projectId: Number(projectId) }
        : {}),
    },
    include: INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.PRODUCTION);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    name: string;
    status: string;
    capacity: string;
    projectId: number | null;
    notes: string;
    sortOrder: number;
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写产品名称");

  const item = await prisma.product.create({
    data: {
      name,
      // status / capacity 是自由文本, 空串统一存 null, 前端渲染成 "-"
      status: body.status?.trim() || null,
      capacity: body.capacity?.trim() || null,
      projectId: body.projectId ?? null,
      notes: body.notes ?? "",
      sortOrder: Number(body.sortOrder) || 0,
    },
    include: INCLUDE,
  });
  return NextResponse.json({ item });
}
