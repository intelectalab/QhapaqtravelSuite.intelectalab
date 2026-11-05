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
