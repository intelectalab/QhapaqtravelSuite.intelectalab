"use server";

import { revalidatePath } from "next/cache";
import type { ReservationCancellation } from "@/lib/reservations";
import { getReservationCancellation } from "@/lib/server/reservations";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const PORTAL_SOURCES: Record<string, { path: string; approve: string; reject: string }> = {
  invoice: { path: "/finance/supplier-invoices", approve: "validate", reject: "observe" },
};

function refresh(result: StepResult): StepResult {
  if (result.done) {
    revalidatePath("/aprobaciones");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function decideApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  const type = text(form, "type");
  const target = encodeURIComponent(text(form, "target"));
  const approve = text(form, "decision") !== "reject";
  const note = text(form, "note") || null;
  const failure = "No pudimos registrar la decisión.";
  const source = PORTAL_SOURCES[text(form, "source")];
  const lock = formValues(form, ["lock_version"]);

  if (source) {
    return refresh(await sendStep(`${source.path}/${target}/${approve ? source.approve : source.reject}`, "POST", { note }, failure));
  }

  if (type === "quote") return refresh(await sendStep(`/quotes/${target}/versions/${encodeURIComponent(text(form, "version_no"))}/internal-approval`, "POST", { decision: approve ? "approve" : "reject", note, ...lock }, failure));
  if (type === "change") {
    const change = encodeURIComponent(text(form, "change_id"));
    return refresh(await sendStep(`/reservations/${target}/changes/${change}/${approve ? "approve" : "reject"}`, "POST", approve ? lock : { note, ...lock }, failure));
  }
  if (type === "cancel") {
    return refresh(
      approve
        ? await sendStep(`/reservations/${target}/cancel`, "POST", { reason: text(form, "cancel_reason") || "Otro", detail: note ?? "Anulación aprobada desde la bandeja de aprobaciones.", ...lock }, failure)
        : await sendStep(`/reservations/${target}/cancel-requests/${encodeURIComponent(text(form, "cancel_id"))}/reject`, "POST", { note }, failure),
    );
  }
  return refresh(await sendStep(`/approvals/${target}/${approve ? "approve" : "reject"}`, "POST", { note, ...lock }, failure));
}

export async function saveApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = formValues(form, ["type", "title", "amount", "currency", "agency", "reservation", "justification"]);
  return refresh(await sendStep(code ? `/approvals/${encodeURIComponent(code)}` : "/approvals", code ? "PATCH" : "POST", body, "No pudimos guardar la solicitud."));
}

export async function withdrawApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approvals/${encodeURIComponent(text(form, "code"))}/withdraw`, "POST", formValues(form, ["note", "lock_version"]), "No pudimos retirar la solicitud."));
}

export async function delegateApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approvals/${encodeURIComponent(text(form, "code"))}/delegate`, "POST", formValues(form, ["user_id", "note", "lock_version"]), "No pudimos delegar la solicitud."));
}

export async function askApprovalInfo(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approvals/${encodeURIComponent(text(form, "code"))}/info-requests`, "POST", formValues(form, ["question", "lock_version"]), "No pudimos enviar la consulta."));
}

export async function answerApprovalInfo(_state: StepResult, form: FormData): Promise<StepResult> {
  const path = `/approvals/${encodeURIComponent(text(form, "code"))}/info-requests/${encodeURIComponent(text(form, "info_id"))}/answer`;
  return refresh(await sendStep(path, "POST", formValues(form, ["answer"]), "No pudimos guardar la respuesta."));
}

export async function resubmitApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approvals/${encodeURIComponent(text(form, "code"))}/resubmit`, "POST", formValues(form, ["note"]), "No pudimos reenviar la solicitud."));
}

export async function saveApprovalRule(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = {
    ...formValues(form, ["type", "permission", "min_amount", "sla_hours"]),
    active: form.get("active") === "on",
    forbid_self: form.get("forbid_self") === "on",
  };
  if (!code) return refresh(await sendStep("/approval-rules", "POST", body, "No pudimos crear la regla."));
  return refresh(await sendStep(`/approval-rules/${encodeURIComponent(code)}`, "PATCH", body, "No pudimos guardar la regla."));
}

export async function deleteApprovalRule(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approval-rules/${encodeURIComponent(text(form, "code"))}`, "DELETE", {}, "No pudimos eliminar la regla."));
}

export async function resetApprovalRules(): Promise<StepResult> {
  return refresh(await sendStep("/approval-rules/reset", "POST", {}, "No pudimos restaurar la matriz."));
}

export async function loadCancellation(reservation: string): Promise<ReservationCancellation | null> {
  return getReservationCancellation(reservation);
}
