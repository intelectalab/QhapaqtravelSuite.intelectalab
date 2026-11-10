"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface OpsState {
  message: string | null;
  done: boolean;
}

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

interface Step {
  path: (id: string, form: FormData) => string | null;
  method: Method;
  fields?: string[];
  lists?: string[];
  flags?: string[];
  failure: string;
}

const id = (value: string) => encodeURIComponent(value);

const ORDER_ACTIONS: Record<string, string> = { pendiente_asignacion: "to-assignment", asignada: "mark-assigned", confirmada: "confirm", en_ejecucion: "start", completada: "close" };

const orderAction = (code: string, form: FormData) => {
  const action = ORDER_ACTIONS[String(form.get("status") ?? "")];
  return action ? `/ops/orders/${id(code)}/${action}` : null;
};

const STEPS: Record<string, Step> = {
  order_create: { path: () => "/ops/orders", method: "POST", fields: ["reservation_code", "coordinator_id"], failure: "No pudimos crear la orden." },
  order_update: { path: (code) => `/ops/orders/${id(code)}`, method: "PATCH", fields: ["coordinator_id"], failure: "No pudimos guardar el coordinador." },
  order_status: { path: orderAction, method: "POST", failure: "No pudimos cambiar el estado." },
  order_cancel: { path: (code) => `/ops/orders/${id(code)}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos cancelar la orden." },
  task_add: { path: (code) => `/ops/orders/${id(code)}/tasks`, method: "POST", fields: ["title"], failure: "No pudimos agregar la tarea." },
  task_toggle: { path: (task) => `/ops/order-tasks/${id(task)}`, method: "PATCH", flags: ["done"], failure: "No pudimos actualizar la tarea." },
  task_delete: { path: (task) => `/ops/order-tasks/${id(task)}`, method: "DELETE", failure: "No pudimos eliminar la tarea." },
  assign: { path: (assignment) => `/ops/assignments/${id(assignment)}/resources`, method: "PUT", fields: ["guide_id", "driver_id", "vehicle_id"], flags: ["ack_warnings"], failure: "No pudimos asignar los recursos." },
  assign_confirm: { path: (assignment) => `/ops/assignments/${id(assignment)}/confirm`, method: "POST", failure: "No pudimos registrar la confirmación." },
  assign_release: { path: (assignment) => `/ops/assignments/${id(assignment)}/release`, method: "POST", failure: "No pudimos liberar los recursos." },
  guide_save: { path: (resource) => (resource ? `/ops/resources/guide/${id(resource)}` : "/ops/resources/guide"), method: "POST", fields: ["full_name", "license_number", "rating", "phone", "status"], lists: ["languages"], failure: "No pudimos guardar el guía." },
  driver_save: { path: (resource) => (resource ? `/ops/resources/driver/${id(resource)}` : "/ops/resources/driver"), method: "POST", fields: ["full_name", "license_number", "license_class", "license_expires_on", "phone", "status"], failure: "No pudimos guardar el conductor." },
  vehicle_save: { path: (resource) => (resource ? `/ops/resources/vehicle/${id(resource)}` : "/ops/resources/vehicle"), method: "POST", fields: ["plate", "vehicle_type", "capacity", "provider_id", "soat_expires_on", "status"], failure: "No pudimos guardar el vehículo." },
  resource_archive: { path: (target) => `/ops/resources/${target}`, method: "DELETE", failure: "No pudimos dar de baja el recurso." },
  rooming_create: { path: () => "/ops/rooming-lists", method: "POST", fields: ["reservation_code", "hotel_id", "check_in", "check_out"], failure: "No pudimos crear la rooming list." },
  rooming_delete: { path: (list) => `/ops/rooming-lists/${id(list)}`, method: "DELETE", failure: "No pudimos eliminar la rooming list." },
  room_save: { path: (target) => `/ops/rooming-lists/${target}`, method: "POST", fields: ["room_number", "room_type", "status"], lists: ["passenger_ids"], failure: "No pudimos guardar la habitación." },
  room_delete: { path: (target) => `/ops/rooming-lists/${target}`, method: "DELETE", failure: "No pudimos eliminar la habitación." },
  rooming_confirm: { path: (list) => `/ops/rooming-lists/${id(list)}/confirm`, method: "POST", failure: "No pudimos confirmar la rooming list." },
  rooming_send: { path: (list) => `/ops/rooming-lists/${id(list)}/send`, method: "POST", failure: "No pudimos enviarla al hotel." },
  voucher_issue: { path: () => "/ops/vouchers", method: "POST", fields: ["service_code", "provider_id", "note"], failure: "No pudimos emitir el voucher." },
  voucher_version: { path: (code) => `/ops/vouchers/${id(code)}/versions`, method: "POST", fields: ["reason"], failure: "No pudimos emitir la nueva versión." },
  voucher_redeem: { path: (code) => `/ops/vouchers/${id(code)}/redeem`, method: "POST", failure: "No pudimos marcarlo como utilizado." },
  voucher_void: { path: (code) => `/ops/vouchers/${id(code)}/void`, method: "POST", fields: ["reason"], failure: "No pudimos anular el voucher." },
  incident_create: { path: () => "/ops/incidents", method: "POST", fields: ["order_code", "type", "severity", "title", "description", "assignee_id"], failure: "No pudimos registrar la incidencia." },
  incident_update: { path: (code) => `/ops/incidents/${id(code)}`, method: "PATCH", fields: ["type", "severity", "title", "description", "assignee_id"], failure: "No pudimos guardar los cambios." },
  incident_take: { path: (code) => `/ops/incidents/${id(code)}/take`, method: "POST", failure: "No pudimos tomar la incidencia." },
  incident_resolve: { path: (code) => `/ops/incidents/${id(code)}/resolve`, method: "POST", fields: ["resolution"], failure: "No pudimos registrar la resolución." },
  incident_close: { path: (code) => `/ops/incidents/${id(code)}/close`, method: "POST", fields: ["comment"], failure: "No pudimos cerrar la incidencia." },
  incident_reopen: { path: (code) => `/ops/incidents/${id(code)}/reopen`, method: "POST", fields: ["reason"], failure: "No pudimos reabrir la incidencia." },
  incident_comment: { path: (code) => `/ops/incidents/${id(code)}/comments`, method: "POST", fields: ["message"], failure: "No pudimos guardar el comentario." },
  service_complete: { path: (service) => `/ops/reservation-services/${id(service)}/complete`, method: "POST", fields: ["note"], failure: "No pudimos marcar el servicio como completado." },
  evidence_remove: { path: (evidence) => `/ops/evidences/${id(evidence)}`, method: "DELETE", fields: ["reason"], failure: "No pudimos retirar la evidencia." },
  doc_validate:{ path: (target) => `/reservations/${target}/validate`, method: "POST", fields: ["doc_number", "expiry_date"], failure: "No pudimos validar el documento." },
  doc_observe: { path: (target) => `/reservations/${target}/observe`, method: "POST", fields: ["reason"], failure: "No pudimos registrar la observación." },
};

const EVIDENCE_TARGETS: Record<string, (code: string) => string> = {
  order: (code) => `/ops/orders/${id(code)}/evidences/upload`,
  incident: (code) => `/ops/incidents/${id(code)}/evidences/upload`,
};

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadEvidence(scope: string, target: string, form: FormData): Promise<OpsState> {
  const path = EVIDENCE_TARGETS[scope]?.(target);
  const file = form.get("file");
  if (!path) return { message: "Acción no disponible.", done: false };
  if (!(file instanceof File) || file.size === 0) return { message: "Elige el archivo de la evidencia.", done: false };
  if (file.size > EVIDENCE_MAX_BYTES) return { message: `${file.name} pesa más de 10 MB.`, done: false };
  const payload = new FormData();
  payload.set("file", file, file.name);
  const service = form.get("reservation_service_id");
  if (scope === "order" && typeof service === "string" && service !== "") payload.set("reservation_service_id", service);
  const result = await apiFetch(path, { method: "POST", form: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos subir la evidencia.", done: false };
  }
  revalidatePath("/operaciones", "layout");
  return { message: null, done: true };
}

const UPDATE_STEPS = new Set(["guide_save", "driver_save", "vehicle_save"]);

export async function opsStep(_state: OpsState, form: FormData): Promise<OpsState> {
  const name = String(form.get("step") ?? "");
  const step = STEPS[name];
  if (!step) return { message: "Acción no disponible.", done: false };
  const target = String(form.get("target") ?? "");
  const path = step.path(target, form);
  if (!path) return { message: "Acción no disponible.", done: false };
  const body: Record<string, unknown> = {};
  for (const field of step.fields ?? []) {
    const raw = form.get(field);
    if (typeof raw === "string") body[field] = raw.trim() === "" ? null : raw.trim();
  }
  for (const list of step.lists ?? []) {
    body[list] = form.getAll(list).filter((value): value is string => typeof value === "string" && value !== "");
  }
  for (const flag of step.flags ?? []) {
    const raw = form.get(flag);
    body[flag] = raw === "1" || raw === "on" || raw === "true";
  }
  const version = form.get("lock_version");
  if (typeof version === "string" && version !== "") body.lock_version = version;
  const method = UPDATE_STEPS.has(name) && target ? "PATCH" : name === "room_save" && form.get("room") ? "PUT" : step.method;
  const result = await apiFetch(path, { method, body: method === "DELETE" && Object.keys(body).length === 0 ? undefined : body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? step.failure, done: false };
  }
  revalidatePath("/operaciones", "layout");
  return { message: null, done: true };
}
