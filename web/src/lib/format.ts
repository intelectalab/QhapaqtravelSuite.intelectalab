const LOCALE = "es-PE";

export const TIME_ZONE = "America/Lima";

const CURRENCY_SYMBOL: Record<string, string> = { PEN: "S/", USD: "US$" };

export const amountAttr = (amount: number | string | null | undefined): string => Number(amount ?? 0).toFixed(2);

export function formatMoney(amount: number | string, currency = "PEN", options: { compact?: boolean } = {}): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const symbol = CURRENCY_SYMBOL[currency] ?? currency;
  if (options.compact && Math.abs(value) >= 1000) {
    const thousands = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value / 1000);
    return `${symbol} ${thousands}k`;
  }
  const formatted = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value).replace(/,/g, " ");
  return `${symbol} ${formatted}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value).replace(/,/g, " ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} %`;
}

export function formatDate(iso: string, style: "short" | "long" = "short", locale = LOCALE): string {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const options: Intl.DateTimeFormatOptions = style === "long"
    ? { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE }
    : { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE };
  return new Intl.DateTimeFormat(locale, options).format(date).replace(/\./g, "");
}

export function shortName(fullName: string): string {
  const [first, last] = fullName.split(" ");
  return last ? `${first} ${last}` : first;
}

export function formatDateTime(iso: string, withYear = true): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE, ...(withYear ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat(LOCALE, options).format(new Date(iso)).replace(/\./g, "");
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthName(isoOrIndex: string | number, locale = LOCALE): string {
  const month = typeof isoOrIndex === "number" ? isoOrIndex : Number(isoOrIndex.slice(5, 7)) - 1;
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, month, 1)).toLowerCase();
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
