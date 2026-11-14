"use server";

import { revalidatePath } from "next/cache";
import type { ChannelAccount, InboxChannel } from "@/lib/inbox";
import { apiFetch } from "@/lib/server/api";
import type { StepResult } from "@/lib/server/resource";

const CHANNELS: InboxChannel[] = ["whatsapp", "email"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function changes(form: FormData, channel: InboxChannel): Record<string, unknown> | null {
  const key: keyof ChannelAccount = channel === "whatsapp" ? "phone_number_id" : "mailbox";
  const body: Record<string, unknown> = {};
  const identifier = text(form, `${channel}.${key}`);
  if (identifier !== text(form, `${channel}.${key}.before`)) body[key] = identifier;
  const sla = text(form, `${channel}.sla`);
  if (sla !== text(form, `${channel}.sla.before`)) body.first_response_sla_minutes = Number(sla);
  const status = text(form, `${channel}.status`);
  if (status !== text(form, `${channel}.status.before`)) body.status = status;
  const secret = text(form, `${channel}.webhook_secret`);
  if (secret !== "") body.webhook_secret = secret;
  return Object.keys(body).length > 0 ? body : null;
}

function responseTimes(form: FormData): Record<string, unknown> | null {
  const body: Record<string, unknown> = {};
  for (const channel of ["webchat", "form", "portal"]) {
    const value = text(form, `response_times.${channel}`);
    if (value !== "" && value !== text(form, `response_times.${channel}.before`)) body[channel] = Number(value);
  }
  return Object.keys(body).length > 0 ? { ...body, lock_version: Number(text(form, "response_times.lock_version") || 0) } : null;
}

export async function saveChannelAccounts(_state: StepResult, form: FormData): Promise<StepResult> {
  const pending = CHANNELS.map((channel) => [channel, changes(form, channel)] as const).filter((entry): entry is readonly [InboxChannel, Record<string, unknown>] => entry[1] !== null);
  const times = responseTimes(form);
  if (pending.length === 0 && times === null) return { done: false, message: "No hay cambios que guardar." };
  if (times !== null) {
    const result = await apiFetch("/inbox/response-times", { method: "PUT", body: times });
    if (!result.ok) {
      const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
      revalidatePath("/inbox");
      return { done: false, message: `Plazos: ${first ?? result.error?.message ?? "No pudimos guardar los plazos."}` };
    }
  }
  for (const [channel, body] of pending) {
    const result = await apiFetch(`/inbox/channel-accounts/${channel}`, { method: "PUT", body });
    if (!result.ok) {
      const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
      revalidatePath("/inbox");
      return { done: false, message: `${channel === "whatsapp" ? "WhatsApp" : "Correo"}: ${first ?? result.error?.message ?? "No pudimos guardar el canal."}` };
    }
  }
  revalidatePath("/inbox");
  return { done: true, message: null };
}
