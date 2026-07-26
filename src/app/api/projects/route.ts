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
    description: string;
  }>;

  const code = (body.code ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!code) return badRequest("请填写项目代号");
  if (!name) return badRequest("请填写项目名称");
  if (body.status !== undefined && !isOneOf(PROJECT_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const dup = await prisma.project.findUnique({ where: { code } });
  if (dup) return NextResponse.json({ error: "项目代号已存在" }, { status: 409 });

  const item = await prisma.project.create({
    data: {
      code,
      name,
      status: body.status ?? "active",
      ownerId: body.ownerId ?? null,
      description: body.description ?? "",
    },
    include: INCLUDE,
  });
  return NextResponse.json({ item });
}
