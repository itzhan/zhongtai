/// 团队资金 U → 人民币，口径只写这里。
export const USDT_CNY_RATE = 6.75;
export function usdtToCny(n: number): number {
  return n * USDT_CNY_RATE;
}

export function toCny(n: number, currency?: string | null): number {
  return currency === "usdt" ? usdtToCny(n) : n;
}

export function fmtLedgerAmount(n: number | null | undefined, currency?: string | null): string {
  if (n == null || isNaN(n)) return "-";
  const s = fmtMoneyShort(n);
  return currency === "usdt" ? `${s} U` : s;
}

export function partyLabel(_kind: string, name: string, _id?: number | null) {
  const who = (name ?? "").trim();
  return who || "-";
}

// Precise money: keeps full digits — used for unit prices and tooltips.
export function fmtMoney(n: number, digits = 4): string {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Compact money for tables/cards: switches unit when large.
//   >= 10,000   → "1.23万"
//   >= 1,000    → "1.23k"
//   < 1,000     → "999.99"
//   < 0.01 (≠0) → "<0.01"
export function fmtMoneyShort(n: number, decimals = 2): string {
  if (n == null || isNaN(n)) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(decimals)}万`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(decimals)}k`;
  if (abs > 0 && abs < 0.01) return `${sign}<0.01`;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

// 只要日期不要时间 —— 立项时间这类字段用它。
export function fmtDay(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 业务日历日 "YYYY-MM-DD"(Asia/Shanghai)。所有 periodDate / batchDate /
// purchaseDate 的默认值都取它 —— 业务口径是上海自然日, 不能用 UTC。
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shanghaiParts(d: Date) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { day, time };
}

/// 账单发生时刻，精确到分：2026-09-20 14:30
export function fmtMinute(d: Date | string | null | undefined, fallbackDate?: string): string {
  if (d) {
    const date = typeof d === "string" ? new Date(d) : d;
    if (!isNaN(date.getTime())) {
      const { day, time } = shanghaiParts(date);
      return `${day} ${time}`;
    }
  }
  return fallbackDate || "-";
}

export function nowDatetimeLocal(): string {
  const { day, time } = shanghaiParts(new Date());
  return `${day}T${time}`;
}

export function toDatetimeLocal(d: Date | string | null | undefined, fallbackDate?: string): string {
  if (d) {
    const date = typeof d === "string" ? new Date(d) : d;
    if (!isNaN(date.getTime())) {
      const { day, time } = shanghaiParts(date);
      return `${day}T${time}`;
    }
  }
  if (fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) return `${fallbackDate}T00:00`;
  return nowDatetimeLocal();
}

export function parseEntryMoment(raw: string): { entryDate: string; entryAt: Date } | null {
  const s = raw.trim().replace(" ", "T");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?)?/);
  if (!m) return null;
  const entryDate = m[1];
  const hm = m[2] ?? "00:00";
  const entryAt = new Date(`${entryDate}T${hm}:00+08:00`);
  if (isNaN(entryAt.getTime())) return null;
  return { entryDate, entryAt };
}

// Compact date: just MM-DD HH:mm for table rows.
export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${mi}`;
}
