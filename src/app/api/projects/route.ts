import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireAdminFresh, requireAuth } from "@/lib/guard";
import { isOneOf, PROJECT_STATUS } from "@/lib/enums";

export const runtime = "nodejs";

const INCLUDE = {
  _count: { select: { deskLinks: true, products: true, purchases: true } },
} as const;

export async function GET(req: Request) {
  const g = await requireAuth();
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const q = (sp.get("q") ?? "").trim();

  const items = await prisma.project.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}),
    },
    include: INCLUDE,
    orderBy: { id: "desc" },
  });
  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      _count: { desks: item._count.deskLinks, products: item._count.products, purchases: item._count.purchases },
    })),
  });
}

export async function POST(req: Request) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    code: string;
    name: string;
    status: string;
    description: string;
    enableDemands: boolean;
    enableBatches: boolean;
    enableDesks: boolean;
  }>;

  const name = (body.name ?? "").trim();
  if (!name) return badRequest("请填写项目名称");
  if (body.status !== undefined && !isOneOf(PROJECT_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const code = `PROJECT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const item = await prisma.project.create({
    data: {
      code,
      name,
      status: body.status ?? "active",
      description: body.description ?? "",
      enableDemands: body.enableDemands === undefined ? true : Boolean(body.enableDemands),
      enableBatches: Boolean(body.enableBatches),
      enableDesks: Boolean(body.enableDesks),
    },
    include: INCLUDE,
  });
  return NextResponse.json({
    item: {
      ...item,
      _count: { desks: item._count.deskLinks, products: item._count.products, purchases: item._count.purchases },
    },
  });
}
