"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface ClientActionState {
  message: string | null;
  done: boolean;
  matches?: { code: string; name: string }[];
  softDuplicate?: boolean;
  code?: string;
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

async function send(path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<ClientActionState> {
  const result = await apiFetch<{ code: string }>(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    const matches = result.error?.details?.matches as ClientActionState["matches"];
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cliente.", done: false, matches, softDuplicate: result.error?.code === "CRM-BR-17" };
  }
  revalidatePath("/crm/clientes", "layout");
  return { message: null, done: true, code: result.data?.code };
}

const payload = (form: FormData) => ({
  kind: text(form, "kind"),
  name: text(form, "name"),
  doc_type: text(form, "doc_type"),
  doc_number: text(form, "doc_number"),
  email: text(form, "email"),
  phone: text(form, "phone"),
  country: text(form, "country"),
  city: text(form, "city"),
  birth_date: text(form, "birth_date"),
  segment: text(form, "segment"),
  owner_id: text(form, "owner_id"),
  tags: text(form, "tags") ?? "",
  confirm_duplicate: form.get("confirm_duplicate") === "1",
});

export async function createClient(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send("/crm/clients", "POST", payload(form));
}

export async function updateClient(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(`/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}`, "PATCH", payload(form));
}

const portalPath = (form: FormData, action = "") => `/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/portal-access${action}`;

export async function invitePortal(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(portalPath(form), "POST", {});
}

export async function resendPortalInvitation(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(portalPath(form, "/resend"), "POST", {});
}

export async function revokePortal(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(portalPath(form, "/revoke"), "POST", { reason: text(form, "reason") });
}

export async function anonymizeClient(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(`/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/anonymize`, "POST", { reason: text(form, "reason"), case: text(form, "case"), confirm: form.get("confirm") === "on" });
}

export async function archiveClient(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(`/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/archive`, "POST", { reason: text(form, "reason") });
}

async function contactCall(path: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>): Promise<ClientActionState> {
  const result = await apiFetch(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos completar la acción.", done: false };
  }
  revalidatePath("/crm/clientes", "layout");
  return { message: null, done: true };
}

const contactsPath = (form: FormData, suffix = "") => `/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/contacts${suffix}`;
const contactPayload = (form: FormData) => ({ name: text(form, "name"), role: text(form, "role"), email: text(form, "email"), phone: text(form, "phone") });

export async function saveClientContact(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  const id = text(form, "contact_id");
  return id ? contactCall(contactsPath(form, `/${encodeURIComponent(id)}`), "PATCH", contactPayload(form)) : contactCall(contactsPath(form), "POST", { ...contactPayload(form), is_primary: form.get("is_primary") === "1" || form.get("is_primary") === "on" });
}

export async function makeClientContactPrimary(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return contactCall(contactsPath(form, `/${encodeURIComponent(text(form, "contact_id") ?? "")}/make-primary`), "POST", {});
}

export async function removeClientContact(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return contactCall(contactsPath(form, `/${encodeURIComponent(text(form, "contact_id") ?? "")}`), "DELETE");
}

export async function sendClientCommunication(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return contactCall(`/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/communications`, "POST", { recipient: text(form, "recipient"), subject: text(form, "subject"), body: text(form, "body") });
}
