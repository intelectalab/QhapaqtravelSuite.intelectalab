import { api, ApiRequestError } from "../api/client";
import { deviceId } from "../api/session";
import { getDb } from "../offline/db";
import { uuidv7 } from "../offline/outbox";
import type { Tone } from "../theme";
import type { Assignment } from "../types";
import { applyCheckin } from "./actions";
import { updateAssignment } from "./repository";

export const PASS_PREFIX = "KPQ";

export interface ScanResponse {
  result: string;
  passenger: string;
  passenger_id: string;
  service: { id: string; code: string; name: string };
  scanned_at: string;
  counts: { total: number; checked_in: number; pending: number };
  message: string;
}

export interface ScanOutcome {
  tone: Extract<Tone, "ok" | "warn" | "bad">;
  title: string;
  message: string;
  passengerId?: string;
  counts?: ScanResponse["counts"];
}

const ERROR_TITLES: Record<string, { tone: ScanOutcome["tone"]; title: string }> = {
  PASS_ALREADY_USED: { tone: "warn", title: "Ya registrado" },
  PASS_OTHER_SERVICE: { tone: "bad", title: "No pertenece a este servicio" },
  CHECKIN_NOT_ASSIGNED: { tone: "bad", title: "No pertenece a tu servicio" },
  PASS_VOID: { tone: "bad", title: "Pase anulado" },
  SERVICE_NOT_TODAY: { tone: "bad", title: "No es para hoy" },
  WAIVER_REQUIRED: { tone: "warn", title: "Falta el deslinde" },
  RULE_NOT_IN_PLAN: { tone: "bad", title: "Check-in con QR no disponible" },
};

export function readPassToken(data: string): string | null {
  const value = data.trim();
  if (!value.startsWith(PASS_PREFIX) || value.length < 20 || value.length > 120 || /\s|\|/.test(value)) return null;
  return value;
}

export function notAPass(): ScanOutcome {
  return { tone: "bad", title: "Código no válido", message: "Este código no es un pase de check-in. Pide al pasajero el QR de «Mi pase» en su portal." };
}

export function offlineOutcome(): ScanOutcome {
  return { tone: "warn", title: "Sin conexión", message: "El pase se valida con tu agencia. Conéctate o marca al pasajero en la lista del servicio." };
}

export function outcomeFromError(error: unknown): ScanOutcome {
  if (!(error instanceof ApiRequestError)) return { tone: "bad", title: "No se pudo validar", message: "Intenta escanear de nuevo." };
  const { status, code, message } = error.detail;
  const known = code ? ERROR_TITLES[code] : undefined;
  if (known) return { ...known, message };
  if (status === 0) return offlineOutcome();
  if (status === 404) return { tone: "bad", title: "Pase no reconocido", message };
  if (status === 403) return { tone: "bad", title: "Sin permiso", message: "Tu usuario no puede registrar ingresos con QR. Pide acceso a tu coordinador." };
  if (status === 429) return { tone: "warn", title: "Espera un momento", message: "Escaneaste muchos pases seguidos. Intenta de nuevo en unos segundos." };
  return { tone: "bad", title: "No se pudo validar", message };
}

export function outcomeFromScan(response: ScanResponse): ScanOutcome {
  return { tone: "ok", title: "Ingreso registrado", message: response.message, passengerId: response.passenger_id, counts: response.counts };
}

export async function scanPass(assignment: Assignment, token: string): Promise<ScanOutcome> {
  try {
    const device = await deviceId();
    const response = await api<ScanResponse>("/ops/checkin/scan", {
      method: "POST",
      body: { token, service_id: assignment.service.code, device_id: device ?? undefined },
      idempotencyKey: uuidv7(),
    });
    const db = await getDb();
    await updateAssignment(db, assignment.id, (current) => applyCheckin(current, response.passenger_id, response.scanned_at, false));
    return outcomeFromScan(response);
  } catch (error) {
    return outcomeFromError(error);
  }
}
