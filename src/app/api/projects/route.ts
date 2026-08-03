import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireAdminFresh, requireAuth } from "@/lib/guard";
import { isOneOf, PROJECT_STATUS } from "@/lib/enums";

export const runtime = "nodejs";

const INCLUDE = {
  owner: { select: { id: true, displayName: true } },
  _count: { select: { desks: true, products: true, purchases: true } },
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
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const g = await requireAdminFresh();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    code: string;
    name: string;
    status: string;
    ownerId: number | null;
    ownerName: string;
    description: string;
    enableDemands: boolean;
    enableBatches: boolean;
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
      ownerId: body.ownerId ?? null,
      ownerName: (body.ownerName ?? "").trim(),
      description: body.description ?? "",
      enableDemands: Boolean(body.enableDemands),
      enableBatches: Boolean(body.enableBatches),
    },
    include: INCLUDE,
  });
  return NextResponse.json({ item });
}
