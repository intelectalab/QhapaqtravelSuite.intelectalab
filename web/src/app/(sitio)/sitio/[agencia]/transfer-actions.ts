"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { orderCookie } from "@/lib/site";
import { apiFetch } from "@/lib/server/api";
import { accountToken, siteRequestHeaders } from "@/lib/server/site";

export interface ProofState {
  done: boolean;
  message: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

function proofForm(form: FormData, withReference: boolean): FormData | string {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return "Elige la foto o el PDF de tu constancia.";
  if (file.size > MAX_BYTES) return "La constancia pesa más de 10 MB.";
  const body = new FormData();
  body.append("file", file, file.name);
  const reference = String(form.get("operation_ref") ?? "").trim();
  if (withReference && reference !== "") body.append("operation_ref", reference);
  return body;
}

function failure(error: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): ProofState {
  const first = error?.errors ? Object.values(error.errors)[0]?.[0] : undefined;
  return { done: false, message: first ?? error?.message ?? fallback };
}

export async function uploadOrderProof(agencia: string, code: string, _state: ProofState, form: FormData): Promise<ProofState> {
  const body = proofForm(form, true);
  if (typeof body === "string") return { done: false, message: body };
  const token = (await cookies()).get(orderCookie(code))?.value;
  if (!token) return { done: false, message: "No encontramos el pedido en este navegador. Abre el enlace de tu correo." };
  const result = await apiFetch(`/public/orders/${encodeURIComponent(code)}/transfer-proof`, { method: "POST", form: body, auth: false, headers: await siteRequestHeaders(agencia, { "X-Order-Token": token }) });
  revalidatePath(`/sitio/${agencia}/confirmacion/${code}`);
  return result.ok ? { done: true, message: null } : failure(result.error, "No pudimos subir la constancia.");
}

export async function uploadAccountProof(agencia: string, payment: string, reservation: string, _state: ProofState, form: FormData): Promise<ProofState> {
  const body = proofForm(form, false);
  if (typeof body === "string") return { done: false, message: body };
  const token = await accountToken(agencia);
  if (!token) return { done: false, message: "Tu sesión venció. Vuelve a ingresar." };
  const result = await apiFetch(`/public/me/payments/${encodeURIComponent(payment)}/transfer-proof`, { method: "POST", form: body, token, headers: await siteRequestHeaders(agencia) });
  revalidatePath(`/sitio/${agencia}/cuenta/reservas/${reservation}`);
  return result.ok ? { done: true, message: null } : failure(result.error, "No pudimos subir la constancia.");
}
