export type DateParts = { year: number; month: number; day: number };

export type DateLimits = { min?: string | null; max?: string | null; disablePast?: boolean; today: string; isDateDisabled?: (iso: string) => boolean };

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

export function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseIso(iso: string | null | undefined): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function parseTyped(text: string): string | null {
  const value = text.trim();
  if (parseIso(value)) return value;
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  const separated = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(value);
  const match = compact ?? separated;
  if (!match) return null;
  const iso = toIso(Number(match[3]), Number(match[2]), Number(match[1]));
  return parseIso(iso) ? iso : null;
}

export function formatTyped(iso: string | null | undefined): string {
  const parts = parseIso(iso);
  return parts ? `${pad(parts.day)}/${pad(parts.month)}/${pad(parts.year, 4)}` : "";
}

export function maskTyped(raw: string): string {
  if (/[/.\-\s]/.test(raw)) return raw.replace(/[^\d/.\-\s]/g, "").slice(0, 10);
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function addDays(iso: string, amount: number): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addMonths(iso: string, amount: number): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  const index = parts.year * 12 + (parts.month - 1) + amount;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return toIso(year, month, Math.min(parts.day, daysInMonth(year, month)));
}

export function weekdayIndex(iso: string): number {
  const parts = parseIso(iso);
  if (!parts) return 0;
  return (new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 6) % 7;
}

export function monthMatrix(year: number, month: number): { iso: string; inMonth: boolean }[][] {
  const first = toIso(year, month, 1);
  let cursor = addDays(first, -weekdayIndex(first));
  const weeks: { iso: string; inMonth: boolean }[][] = [];
  for (let week = 0; week < 6; week++) {
    const days = [];
    for (let day = 0; day < 7; day++) {
      const parts = parseIso(cursor);
      days.push({ iso: cursor, inMonth: parts?.month === month && parts.year === year });
      cursor = addDays(cursor, 1);
    }
    weeks.push(days);
  }
  return weeks;
}

export function timeSlots(step = 15, keep?: string | null): string[] {
  const slots = Array.from({ length: Math.ceil(1440 / step) }, (_, index) => `${pad(Math.floor((index * step) / 60))}:${pad((index * step) % 60)}`);
  if (keep && /^\d{2}:\d{2}$/.test(keep) && !slots.includes(keep)) return [...slots, keep].sort();
  return slots;
}

export function splitDateTime(value: string | null | undefined): { date: string | null; time: string | null } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value ?? "");
  if (!match || !parseIso(match[1])) return { date: null, time: null };
  return { date: match[1], time: match[2] ?? null };
}

export function todayIso(timeZone = "America/Lima"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

export function isDisabledDate(iso: string, limits: DateLimits): boolean {
  if (limits.disablePast && iso < limits.today) return true;
  if (limits.min && iso < limits.min) return true;
  if (limits.max && iso > limits.max) return true;
  return limits.isDateDisabled?.(iso) ?? false;
}
