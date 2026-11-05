const LOCALE = "es-PE";

const CURRENCY_SYMBOL: Record<string, string> = { PEN: "S/", USD: "US$" };

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

export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} %`;
}

export function formatDate(iso: string, style: "short" | "long" = "short"): string {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const options: Intl.DateTimeFormatOptions = style === "long"
    ? { weekday: "long", day: "numeric", month: "long" }
    : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(LOCALE, options).format(date).replace(/\./g, "");
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthName(isoOrIndex: string | number): string {
  const month = typeof isoOrIndex === "number" ? isoOrIndex : Number(isoOrIndex.slice(5, 7)) - 1;
  return new Intl.DateTimeFormat(LOCALE, { month: "long" }).format(new Date(2026, month, 1)).toLowerCase();
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
