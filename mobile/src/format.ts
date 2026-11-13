import type { Tone } from "./theme";
import type { AssignmentStatus } from "./types";

const LOCALE = "es-PE";
const ZONE = "America/Lima";

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayLabel(iso: string, today: string = todayIso()): string {
  if (iso === today) return "Hoy";
  if (iso === addDays(today, 1)) return "Mañana";
  if (iso === addDays(today, -1)) return "Ayer";
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

export function shortDay(iso: string): { weekday: string; day: string } {
  const date = new Date(`${iso}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" }).format(date).replace(".", ""),
    day: new Intl.DateTimeFormat(LOCALE, { day: "numeric", timeZone: "UTC" }).format(date),
  };
}

export function timeOf(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: ZONE }).format(new Date(value));
}

export function sinceLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "Nunca";
  const minutes = Math.round((now.getTime() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONE }).format(new Date(value));
}

export const STATUS: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Por asignar", tone: "mute" },
  asignada: { label: "Por confirmar", tone: "warn" },
  confirmada: { label: "Confirmado", tone: "info" },
  en_curso: { label: "En curso", tone: "sun" },
  completada: { label: "Completado", tone: "ok" },
  cancelada: { label: "Cancelado", tone: "bad" },
};

export const INCIDENT_STATUS: Record<string, string> = { abierta: "Abierta", en_proceso: "En proceso", resuelta: "Resuelta", cerrada: "Cerrada" };

export const SEVERITY_TONE: Record<string, Tone> ={ baja: "mute", media: "info", alta: "warn", critica: "bad" };

export const STEPS = ["Asignado", "Confirmado", "Inicio", "Check-in", "Evidencia", "Fin"] as const;

export function stepIndex(status: AssignmentStatus, checkedIn: number, evidences: number): number {
  if (status === "completada") return 6;
  if (status === "en_curso") return checkedIn === 0 ? 3 : evidences > 0 ? 5 : 4;
  if (status === "confirmada") return 2;
  return 1;
}

export function tripLabel(trip: { days_left: number; day: number; days_total: number }): string {
  if (trip.days_left > 0) return trip.days_left === 1 ? "Tu viaje empieza mañana" : `Faltan ${trip.days_left} días para tu viaje`;
  if (trip.day >= 1 && trip.day <= trip.days_total) return `Día ${trip.day} de ${trip.days_total}`;
  return "Viaje finalizado";
}

export function countdownLabel(startsAt: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "en un momento" : `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h ${minutes % 60} min`;
  return `en ${Math.floor(hours / 24)} d ${hours % 24} h`;
}
