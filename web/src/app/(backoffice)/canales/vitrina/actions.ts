"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const lines = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

function listingBody(form: FormData): Record<string, unknown> {
  const model = text(form, "model") || "propina";
  return {
    title: text(form, "title"),
    city: text(form, "city").toLowerCase(),
    zone: text(form, "zone") || null,
    theme: text(form, "theme") || null,
    languages: form.getAll("languages").map(String),
    start_times: lines(text(form, "start_times")),
    duration_hours: Number(text(form, "duration_hours") || 2),
    meeting_point: text(form, "meeting_point"),
    model,
    price: model === "pago" ? Number(text(form, "price") || 0) : 0,
    capacity: Number(text(form, "capacity") || 20),
    highlights: text(form, "highlights").split("\n").map((item) => item.trim()).filter(Boolean),
  };
}

export async function saveListing(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const result = code
    ? await sendStep(`/channels/showcase/listings/${encodeURIComponent(code)}`, "PATCH", { ...listingBody(form), action: "editar" }, "No pudimos guardar la publicación.")
    : await sendStep("/channels/showcase/listings", "POST", { ...listingBody(form), own_content: form.get("own_content") === "1" }, "No pudimos enviar la publicación a revisión.");
  if (result.done) revalidatePath("/canales/vitrina");
  return result;
}

export async function toggleListing(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/showcase/listings/${encodeURIComponent(text(form, "code"))}`, "PATCH", { action: text(form, "action") }, "No pudimos cambiar la publicación.");
  if (result.done) revalidatePath("/canales/vitrina");
  return result;
}

export async function markAttendance(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/showcase/bookings/${encodeURIComponent(text(form, "code"))}/attendance`, "POST", { status: text(form, "status") }, "No pudimos marcar la asistencia.");
  if (result.done) revalidatePath("/canales/vitrina");
  return result;
}
