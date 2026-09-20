import { prisma } from "./db";
import { FUND_CURRENCY, isOneOf, PARTY_KIND, PAY_CHANNEL, type PartyKind } from "./enums";

export type TransferFields = {
  fromKind: string;
  fromId: number | null;
  fromName: string;
  toKind: string;
  toId: number | null;
  toName: string;
  currency: string;
  channel: string;
};

export async function resolveParty(
  kind: unknown,
  id: unknown,
): Promise<{ error: string } | { kind: PartyKind; id: number; name: string }> {
  if (!isOneOf(PARTY_KIND, kind)) return { error: "请选择团队成员或合作伙伴" };
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return { error: "请选择具体的人" };
  if (kind === "member") {
    const row = await prisma.teamMember.findUnique({ where: { id: n }, select: { id: true, name: true } });
    if (!row) return { error: "团队成员不存在" };
    return { kind, id: row.id, name: row.name };
  }
  const row = await prisma.partner.findUnique({ where: { id: n }, select: { id: true, name: true } });
  if (!row) return { error: "合作伙伴不存在" };
  return { kind, id: row.id, name: row.name };
}

export async function parseTransfer(
  body: Record<string, unknown>,
  required: boolean,
): Promise<{ error: string } | TransferFields> {
  const hasFrom = body.fromKind !== undefined || body.fromId !== undefined;
  const hasTo = body.toKind !== undefined || body.toId !== undefined;
  if (required || hasFrom || hasTo) {
    if (!hasFrom) return { error: "请填写转出人" };
    if (!hasTo) return { error: "请填写转入人" };
  }

  let fromKind = "";
  let fromId: number | null = null;
  let fromName = "";
  let toKind = "";
  let toId: number | null = null;
  let toName = "";

  if (hasFrom) {
    const from = await resolveParty(body.fromKind, body.fromId);
    if ("error" in from) return from;
    fromKind = from.kind;
    fromId = from.id;
    fromName = from.name;
  }
  if (hasTo) {
    const to = await resolveParty(body.toKind, body.toId);
    if ("error" in to) return to;
    toKind = to.kind;
    toId = to.id;
    toName = to.name;
  }
  if (fromKind && toKind && fromKind === toKind && fromId === toId) {
    return { error: "转出人和转入人不能是同一个人" };
  }

  let currency = "cny";
  if (body.currency !== undefined) {
    if (!isOneOf(FUND_CURRENCY, body.currency)) return { error: "币种非法" };
    currency = body.currency;
  } else if (!required) {
    currency = "";
  }

  let channel = "";
  if (body.channel !== undefined) {
    if (!isOneOf(PAY_CHANNEL, body.channel)) return { error: "请选择支付宝、微信或银行卡" };
    channel = body.channel;
  } else if (required) {
    return { error: "请选择转账渠道" };
  }

  return { fromKind, fromId, fromName, toKind, toId, toName, currency, channel };
}

export function partyClause(kind: PartyKind, id: number) {
  return {
    OR: [
      { fromKind: kind, fromId: id },
      { toKind: kind, toId: id },
    ],
  };
}


