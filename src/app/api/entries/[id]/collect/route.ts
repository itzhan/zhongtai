import { prisma } from "@/lib/db";
import { PAY_CHANNEL, isOneOf } from "@/lib/enums";
import { parseEntryMoment } from "@/lib/format";
import { badRequest, forbidden, notFound, parseId, requireRoleFresh } from "@/lib/guard";
import { resolveParty } from "@/lib/ledger";
import { jsonItem } from "@/lib/mask";
import { ROLES } from "@/lib/rbac";

export const runtime = "nodejs";

const INCLUDE = {
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  supplier: { select: { id: true, name: true } },
} as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireRoleFresh(ROLES.SALES, ROLES.FINANCE);
  if (!g.ok) return g.res;
  const id = parseId((await ctx.params).id);
  if (!id) return badRequest("id 非法");

  const existing = await prisma.financeEntry.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return notFound("记录不存在");
  if (existing.kind !== "receivable") return badRequest("只有待收款可以入账");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const to = await resolveParty(body.toKind ?? "member", body.toId);
  if ("error" in to) return badRequest("请选择钱打给了谁");
  if (!isOneOf(PAY_CHANNEL, body.channel)) return badRequest("请选择转账渠道");
  const moment = parseEntryMoment(String(body.entryDate ?? body.entryAt ?? ""));
  if (!moment) return badRequest("请填写到账时间");
  if (existing.fromKind === to.kind && existing.fromId === to.id) {
    return forbidden("欠款人和收款人不能是同一个人");
  }

  const item = await prisma.financeEntry.update({
    where: { id },
    data: {
      kind: "income",
      toKind: to.kind,
      toId: to.id,
      toName: to.name,
      channel: body.channel,
      entryDate: moment.entryDate,
      entryAt: moment.entryAt,
    },
    include: INCLUDE,
  });
  return jsonItem("financeEntry", g.session.role, item);
}
