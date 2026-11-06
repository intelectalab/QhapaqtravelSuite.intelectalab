import type { Tone } from "./tone";

export type ProductStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "ARCHIVED";

export interface ProductRow {
  code: string;
  name: string;
  type: string;
  category: string;
  subcategory: string | null;
  destination: string;
  destination_path: string;
  duration: { value: number; unit: string };
  modality: string;
  status: ProductStatus;
  channels: string[];
  featured: boolean;
  price_from?: { amount: string; currency: string } | null;
}

export interface ProductDetail extends ProductRow {
  internal_name: string;
  lock_version: number;
  ids: { type: string; category: string; subcategory: string | null; destination: string; provider: string | null };
  raw: { is_b2b: boolean; is_ecommerce: boolean; availability_model: string; markup_pct: number | null };
  sku: string;
  short_description: string | null;
  long_description: string | null;
  pax: { min: number; max: number };
  age: { min: number; max: number };
  advance_days: { min: number; max: number };
  markup_pct: string | null;
  provider: { name: string; type: string; phone: string | null } | null;
  itinerary: { day: number; title: string; items: { time: string | null; activity: string; type: string | null; location: string | null }[] }[];
  includes: string[];
  excludes: string[];
  requirements: string[];
  policies: { cancellation: string; modification: string; no_show: string; refund: string; penalties: string | null; advance_min: string | null; advance_max: string | null } | null;
  rates: { ref: string; type: string; segment: string; channel: string; currency: string; basis: string; price: string; cost: string | null; margin_pct: number | null; valid_from: string; valid_to: string; active: boolean }[];
}

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "info" },
  REVIEW: { label: "En revisión", tone: "sun" },
  APPROVED: { label: "Aprobado", tone: "accent" },
  ACTIVE: { label: "Activo", tone: "ok" },
  SUSPENDED: { label: "Suspendido", tone: "bad" },
  INACTIVE: { label: "Inactivo", tone: "mute" },
  ARCHIVED: { label: "Archivado", tone: "mute" },
};

export function durationLabel(duration: ProductRow["duration"]): string {
  const value = Number.isInteger(duration.value) ? duration.value : duration.value.toFixed(1);
  const unit = duration.value === 1 ? duration.unit.replace(/s$/, "").replace(/día$/, "día") : duration.unit;
  return `${value} ${unit}`;
}

export interface ProductFormOptions {
  types: { id: string; name: string }[];
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  destinations: { id: string; name: string; path: string; level: number }[];
  providers: { id: string; name: string; type: string }[];
  units: string[];
  modalities: string[];
  availability: string[];
  can_create: boolean;
  can_update: boolean;
  can_activate: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string | null;
}

export const AVAILABILITY_LABEL: Record<string, string> = {
  SIN_CONTROL: "Sin control de cupos",
  CUPOS: "Cupos por día",
  CAPACIDAD: "Capacidad fija",
  POR_PROVEEDOR: "Según el proveedor",
  POR_ACTIVIDAD: "Por actividad",
  POR_TRANSPORTE: "Por transporte",
  POR_HABITACION: "Por habitación",
  POR_SALIDA: "Por salida programada",
  POR_FECHA: "Por fecha",
};

export const LIFECYCLE: { action: string; label: string; from: ProductStatus[]; reason: boolean; activate: boolean; primary?: boolean; description: string }[] = [
  { action: "submit-review", label: "Enviar a revisión", from: ["DRAFT"], reason: false, activate: false, primary: true, description: "Gerencia lo revisa antes de aprobarlo. Mientras tanto se puede seguir completando." },
  { action: "approve", label: "Aprobar", from: ["REVIEW"], reason: false, activate: true, primary: true, description: "Queda listo para activarse cuando cumpla el checklist." },
  { action: "return-to-draft", label: "Devolver", from: ["REVIEW"], reason: true, activate: true, description: "Vuelve a borrador para que lo corrijan. Explica qué falta." },
  { action: "activate", label: "Activar", from: ["APPROVED", "SUSPENDED", "INACTIVE"], reason: false, activate: true, primary: true, description: "Se podrá cotizar y vender. Antes revisamos los 12 requisitos del checklist." },
  { action: "suspend", label: "Suspender", from: ["ACTIVE"], reason: true, activate: true, description: "Deja de venderse por un tiempo. Ventas recibe el aviso." },
  { action: "deactivate", label: "Inactivar", from: ["ACTIVE", "SUSPENDED"], reason: true, activate: true, description: "Deja de venderse hasta que alguien lo vuelva a activar." },
  { action: "archive", label: "Archivar", from: ["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "SUSPENDED", "INACTIVE"], reason: true, activate: true, description: "Sale del catálogo de forma definitiva. Su historial se conserva." },
];
