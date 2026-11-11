import type { MonthPoint } from "@/lib/dashboard";
import { formatMoney, formatPercent } from "@/lib/format";

export function money(amount: number, currency = "PEN"): string {
  return formatMoney(amount, currency, { compact: true });
}

export function deltaNote(current: number, previous: number, previousLabel: string | null): string {
  if (!previousLabel) return "Primer mes con ventas";
  if (previous === 0) return `Sin ventas en ${previousLabel.toLowerCase()}`;
  const delta = ((current - previous) / previous) * 100;
  return `${delta >= 0 ? "+" : "−"}${formatPercent(Math.abs(delta))} frente a ${previousLabel.toLowerCase()}`;
}

export function closedMonths(months: MonthPoint[]): MonthPoint[] {
  return months.slice(0, -1);
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function byCurrency(rows: { currency: string; amount: number }[]): string {
  return rows.map((row) => formatMoney(row.amount, row.currency)).join(" + ");
}
