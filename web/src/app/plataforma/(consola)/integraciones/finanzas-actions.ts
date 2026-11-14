"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function credentials(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("credential_") && typeof value === "string" && value.trim() !== "") values[key.slice("credential_".length)] = value.trim();
  }
  return values;
}

function done(outcome: ConsoleResult, path: string): ConsoleResult {
  if (outcome.done) revalidatePath(path, "layout");
  return outcome;
}

const FX = "/plataforma/integraciones/tipo-de-cambio";
const OSE = "/plataforma/integraciones/facturacion-electronica";

export async function createFxProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend("/fx-providers", "POST", { code: text(form, "code"), name: text(form, "name"), driver: text(form, "driver"), note: text(form, "note") || null, credentials: credentials(form) }, "No pudimos crear el proveedor."), FX);
}

export async function updateFxProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const body: Record<string, unknown> = { name: text(form, "name"), note: text(form, "note") || null };
  const keys = credentials(form);
  if (Object.keys(keys).length > 0) body.credentials = keys;
  return done(await platformSend(`/fx-providers/${encodeURIComponent(text(form, "code"))}`, "PATCH", body, "No pudimos guardar el proveedor."), FX);
}

export async function deleteFxProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/fx-providers/${encodeURIComponent(text(form, "code"))}`, "DELETE", {}, "No pudimos eliminar el proveedor."), FX);
}

export async function testPlatformFxProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend<{ ok: boolean; result: string }>(`/fx-providers/${encodeURIComponent(text(form, "code"))}/test`, "POST", {}, "No pudimos probar la conexión.", (data) => (data ? `${data.ok ? "Validado" : "Sigue por validar"}: ${data.result}` : null)), FX);
}

export async function createOseProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend("/ose-providers", "POST", { code: text(form, "code"), name: text(form, "name"), driver: text(form, "driver"), status: text(form, "status") || "por_homologar", note: text(form, "note") || null }, "No pudimos agregar el OSE."), OSE);
}

export async function updateOseProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/ose-providers/${encodeURIComponent(text(form, "code"))}`, "PATCH", { name: text(form, "name"), status: text(form, "status"), note: text(form, "note") || null }, "No pudimos guardar el OSE."), OSE);
}

export async function deleteOseProvider(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/ose-providers/${encodeURIComponent(text(form, "code"))}`, "DELETE", {}, "No pudimos eliminar el OSE."), OSE);
}

export async function saveTenantOseCredentials(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const keys = credentials(form);
  if (Object.keys(keys).length === 0) return { done: false, message: "Escribe al menos una credencial." };
  return done(await platformSend(`/tenants/${encodeURIComponent(text(form, "tenant"))}/ose/credentials`, "PUT", { credentials: keys }, "No pudimos guardar las credenciales."), "/plataforma/agencias");
}

export async function clearTenantOseCredentials(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/tenants/${encodeURIComponent(text(form, "tenant"))}/ose/credentials`, "DELETE", {}, "No pudimos quitar las credenciales."), "/plataforma/agencias");
}

export async function testTenantOse(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend<{ ok: boolean; result: string }>(`/tenants/${encodeURIComponent(text(form, "tenant"))}/ose/test`, "POST", {}, "No pudimos probar la conexión.", (data) => (data ? `${data.ok ? "Conexión correcta" : "La prueba no pasó"}: ${data.result}` : null)), "/plataforma/agencias");
}
