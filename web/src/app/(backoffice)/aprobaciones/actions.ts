"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const PORTAL_SOURCES: Record<string, { path: string; approve: string; reject: string }> = {
  settlement: { path: "settlements", approve: "approve", reject: "reject" },
  rate: { path: "provider-rates", approve: "approve", reject: "reject" },
  invoice: { path: "supplier-invoices", approve: "validate", reject: "observe" },
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

  if (source) {
    return refresh(await sendStep(`/approvals/${source.path}/${target}/${approve ? source.approve : source.reject}`, "POST", { note }, failure));
  }

  if (type === "quote") return refresh(await sendStep(`/quotes/${target}/internal-approval`, "POST", { approve, note }, failure));
  if (type === "change") {
    const change = encodeURIComponent(text(form, "change_id"));
    return refresh(await sendStep(`/reservations/${target}/changes/${change}/${approve ? "approve" : "reject"}`, "POST", approve ? {} : { note }, failure));
  }
  if (type === "cancel") {
    return refresh(
      approve
        ? await sendStep(`/reservations/${target}/cancel`, "POST", { reason: text(form, "cancel_reason") || "Otro", detail: note ?? "Anulación aprobada desde la bandeja de aprobaciones." }, failure)
        : await sendStep(`/reservations/${target}/cancel-requests/reject`, "POST", { note }, failure),
    );
  }
  return refresh(await sendStep(`/approvals/${target}/${approve ? "approve" : "reject"}`, "POST", { note }, failure));
}

export async function saveApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = formValues(form, ["type", "title", "amount", "currency", "reference", "justification"]);
  return refresh(await sendStep(code ? `/approvals/${encodeURIComponent(code)}` : "/approvals", code ? "PATCH" : "POST", body, "No pudimos guardar la solicitud."));
}

export async function withdrawApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/approvals/${encodeURIComponent(text(form, "code"))}/withdraw`, "POST", formValues(form, ["note"]), "No pudimos retirar la solicitud."));
}

export async function saveApprovalRule(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = {
    ...formValues(form, ["permission", "min_amount", "sla_hours"]),
    active: form.get("active") === "on",
    forbid_self: form.get("forbid_self") === "on",
  };
  return refresh(await sendStep(`/approval-rules/${encodeURIComponent(text(form, "code"))}`, "PATCH", body, "No pudimos guardar la regla."));
}
