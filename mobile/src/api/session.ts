import { Platform } from "react-native";
import { APP_VERSION, TENANT_HOST } from "../config";
import { clearLocalData, getState, setState } from "../offline/db";
import { pushToken } from "../push";
import { api, ApiRequestError, setToken } from "./client";

export type SessionKind = "operator" | "passenger";

interface LoginResult {
  token: string;
  mfa_required: boolean;
  experience: string;
}

export type LoginStep = { next: "ready" } | { next: "mfa" };

export const NOT_OPERATOR = "Esta opción es para guías y conductores. Si eres pasajero, ingresa con tu código de reserva.";

const SITE_HEADERS: Record<string, string> = TENANT_HOST ? { "X-Forwarded-Host": TENANT_HOST } : {};

export async function login(email: string, password: string): Promise<LoginStep> {
  const result = await api<LoginResult>("/auth/login", { method: "POST", body: { email: email.trim(), password }, auth: false });
  if (result.experience !== "mobile") throw new ApiRequestError({ status: 403, message: NOT_OPERATOR });
  await setToken(result.token);
  await setState("kind", "operator");
  if (result.mfa_required) return { next: "mfa" };
  await registerDevice("operador");
  return { next: "ready" };
}

export async function verifyMfa(code: string): Promise<void> {
  await api("/auth/mfa/verify", { method: "POST", body: { code: code.replace(/\s+/g, "") } });
  await registerDevice("operador");
}

export async function requestPassengerLink(email: string, reservation: string): Promise<string> {
  const result = await api<{ message: string }>("/portal/passenger/auth/link", { method: "POST", body: { email: email.trim(), code: reservation.trim().toUpperCase() }, auth: false, headers: SITE_HEADERS });
  return result.message;
}

export function extractToken(input: string): string | null {
  const match = input.trim().match(/[A-Za-z0-9]{48}/);
  return match ? match[0] : null;
}

export async function verifyPassenger(input: string): Promise<void> {
  const token = extractToken(input);
  if (!token) throw new ApiRequestError({ status: 422, message: "Pega el enlace completo que te llegó por correo." });
  const result = await api<{ token: string }>("/portal/passenger/auth/verify", { method: "POST", body: { token }, auth: false, headers: SITE_HEADERS });
  await setToken(result.token);
  await setState("kind", "passenger");
  await registerDevice("pasajero");
}

async function registerDevice(app: "operador" | "pasajero"): Promise<void> {
  const token = await pushToken();
  const device = await api<{ id: string }>("/mobile/devices", { method: "POST", body: { app, platform: Platform.OS === "ios" ? "ios" : "android", app_version: APP_VERSION, expo_push_token: token ?? undefined } });
  await setState("device_id", device.id);
}

export async function sessionKind(): Promise<SessionKind> {
  return (await getState("kind")) === "passenger" ? "passenger" : "operator";
}

export async function deviceId(): Promise<string | null> {
  return getState("device_id");
}

export async function logout(): Promise<void> {
  const device = await deviceId();
  if (device) await api(`/mobile/devices/${device}`, { method: "DELETE" }).catch(() => undefined);
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  await setToken(null);
  await clearLocalData();
}
