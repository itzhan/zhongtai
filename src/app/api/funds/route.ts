import { prisma } from "@/lib/db";
import { FUND_CURRENCY, FUND_KIND, isOneOf } from "@/lib/enums";
import { badRequest, requireRole, requireRoleFresh } from "@/lib/guard";
import { jsonItem, jsonItems } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requireRole(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const kind = new URL(req.url).searchParams.get("kind");
  if (kind && kind !== "all" && !isOneOf(FUND_KIND, kind)) {
    return badRequest("资金类型非法");
  }

  const items = await prisma.companyFund.findMany({
    where: kind && kind !== "all" ? { kind } : {},
    orderBy: [{ holder: "asc" }, { id: "asc" }],
  });

  return jsonItems("companyFund", g.session.role, items);
}

export async function POST(req: Request) {
  const g = await requireRoleFresh(ROLES.FINANCE);
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    holder: string;
    name: string;
    kind: string;
    currency: string;
    amount: number;
    uncertain: boolean;
    note: string;
  }>;

  const holder = (body.holder ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!holder) return badRequest("请填写归属");
  if (!name) return badRequest("请填写位置或对方名称");
  if (!isOneOf(FUND_KIND, body.kind)) return badRequest("请选择资金类型");
  const currency = body.currency ?? "cny";
  if (!isOneOf(FUND_CURRENCY, currency)) return badRequest("请选择币种");
  const uncertain = Boolean(body.uncertain);
  const amount = uncertain ? 0 : Number(body.amount);
  if (!uncertain && (!Number.isFinite(amount) || amount < 0)) return badRequest("金额非法");

  const item = await prisma.companyFund.create({
    data: {
      holder,
      name,
      kind: body.kind,
      currency,
      amount,
      uncertain,
      note: (body.note ?? "").trim(),
    },
  });

  return jsonItem("companyFund", g.session.role, item);
}
