import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { isOneOf, RESOURCE_STATUS } from "@/lib/enums";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  source: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
} as const;

export async function GET(req: Request) {
  const g = await requireRole(ROLES.RESOURCE, ROLES.PRODUCTION, ROLES.FINANCE);
  if (!g.ok) return g.res;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const providerKey = sp.get("providerKey");
  const status = sp.get("status");
  const sourceId = sp.get("sourceId");

  const items = await prisma.emailResource.findMany({
    where: {
      ...(q ? { address: { contains: q } } : {}),
      ...(providerKey && providerKey !== "all" ? { providerKey } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(sourceId && sourceId !== "all" ? { sourceId: Number(sourceId) } : {}),
    },
    include: INCLUDE,
    orderBy: { id: "desc" },
  });

  return jsonItems("email", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.RESOURCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    address: string;
    password: string;
    providerKey: string;
    recoveryInfo: string;
    status: string;
    sourceId: number | null;
    projectId: number | null;
    notes: string;
    /// 批量录入: 每行 address----password
    bulk: { address: string; password: string }[];
  }>;

  if (body.status !== undefined && !isOneOf(RESOURCE_STATUS, body.status)) {
    return badRequest("状态非法");
  }

  const common = {
    providerKey: body.providerKey || "mock",
    sourceId: body.sourceId ?? null,
    projectId: body.projectId ?? null,
    status: body.status ?? "available",
    recoveryInfo: body.recoveryInfo ?? "",
    notes: body.notes ?? "",
  };

  if (body.bulk?.length) {
    const rows = body.bulk.map((r) => ({
      ...common,
      address: (r.address ?? "").trim(),
      password: r.password ?? "",
    }));
    const bad = rows.findIndex((r) => !r.address);
    if (bad >= 0) return badRequest(`第 ${bad + 1} 条缺少邮箱地址`);

    // address 是 unique, 重复的跳过而不是整批失败 —— 批量粘贴时有重复
    // 是常态, 因此这里与卡的「整批拒绝」策略不同。
    // SQLite 的 createMany 不支持 skipDuplicates, 所以先查后插。
    const addresses = rows.map((r) => r.address);
    const existing = await prisma.emailResource.findMany({
      where: { address: { in: addresses } },
      select: { address: true },
    });
    const taken = new Set(existing.map((e) => e.address));
    const seen = new Set<string>();
    const fresh = rows.filter((r) => {
      if (taken.has(r.address) || seen.has(r.address)) return false; // 也要去掉粘贴内容自身的重复
      seen.add(r.address);
      return true;
    });

    if (fresh.length) await prisma.emailResource.createMany({ data: fresh });
    return NextResponse.json({
      ok: true,
      count: fresh.length,
      skipped: rows.length - fresh.length,
    });
  }

  const address = (body.address ?? "").trim();
  if (!address) return badRequest("请填写邮箱地址");

  const dup = await prisma.emailResource.findUnique({ where: { address } });
  if (dup) return NextResponse.json({ error: "该邮箱已存在" }, { status: 409 });

  const item = await prisma.emailResource.create({
    data: { ...common, address, password: body.password ?? "" },
    include: INCLUDE,
  });

  return jsonItem("email", g.session.role, item);
}
