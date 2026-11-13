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

export async function saveChannelAccounts(_state: StepResult, form: FormData): Promise<StepResult> {
  const pending = CHANNELS.map((channel) => [channel, changes(form, channel)] as const).filter((entry): entry is readonly [InboxChannel, Record<string, unknown>] => entry[1] !== null);
  if (pending.length === 0) return { done: false, message: "No hay cambios que guardar." };
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
