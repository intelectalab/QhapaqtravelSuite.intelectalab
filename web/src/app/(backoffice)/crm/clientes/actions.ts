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

export async function archiveClient(_state: ClientActionState, form: FormData): Promise<ClientActionState> {
  return send(`/crm/clients/${encodeURIComponent(text(form, "code") ?? "")}/archive`, "POST", { reason: text(form, "reason") });
}
