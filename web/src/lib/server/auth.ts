import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { REALMS, type Realm } from "@/lib/realms";
import { apiFetch } from "./api";
import { completeMfa, endSession, sessionToken, startSession } from "./session";

export interface FormState {
  message: string | null;
  fields?: Record<string, string>;
}

interface SessionData {
  token?: string;
  mfa_required: boolean;
  home: string;
  realm?: Realm;
}

const API_PREFIX: Record<Realm, string> = { agency: "", platform: "/platform" };

const loginSchema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo.").email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

const mfaSchema = z.object({
  code: z.string().trim().regex(/^\d{3}\s?\d{3}$/, "El código tiene 6 dígitos."),
});

function safeNext(value: FormDataEntryValue | null, realm: Realm, fallback: string): string {
  const next = typeof value === "string" ? value : "";
  const inside = realm === "platform" ? next.startsWith(`${REALMS.platform.path}/`) : !next.startsWith(`${REALMS.platform.path}`);
  return next.startsWith("/") && !next.startsWith("//") && inside ? next : fallback;
}

export async function signIn(form: FormData, extra: Record<string, unknown> = {}): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { message: parsed.error.issues[0].message, fields: { email: String(form.get("email") ?? "") } };

  const result = await apiFetch<SessionData>("/auth/login", { method: "POST", auth: false, body: { ...parsed.data, ...extra, device_name: "web" } });

  if (!result.ok || !result.data?.token) {
    const message = result.status === 429 ? "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo." : result.error?.message ?? "No pudimos iniciar tu sesión.";
    return { message, fields: { email: parsed.data.email } };
  }

  const realm = result.data.realm ?? "agency";
  await startSession(result.data.token, result.data.mfa_required, realm);
  const next = safeNext(form.get("next"), realm, result.data.home);
  redirect(result.data.mfa_required ? `${REALMS[realm].mfaPage}?next=${encodeURIComponent(next)}` : next);
}

export async function confirmMfa(realm: Realm, form: FormData): Promise<FormState> {
  const parsed = mfaSchema.safeParse({ code: form.get("code") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const result = await apiFetch<SessionData>(`${API_PREFIX[realm]}/auth/mfa/verify`, { method: "POST", body: parsed.data, realm });
  if (!result.ok || !result.data) {
    if (result.status === 401) redirect(REALMS[realm].logout);
    const message = result.status === 429 ? "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo." : result.error?.message ?? "No pudimos verificar el código.";
    return { message };
  }

  await completeMfa(realm);
  redirect(safeNext(form.get("next"), realm, result.data.home));
}

export async function signOut(realm: Realm): Promise<void> {
  if (await sessionToken(realm)) await apiFetch(`${API_PREFIX[realm]}/auth/logout`, { method: "POST", realm });
  await endSession(realm);
}
