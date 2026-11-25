import type { Tone } from "@/lib/tone";

export type ExternalOfferKind = "aereo" | "hotel" | "auto" | "seguro";

export type ExternalOfferStatus = "cotizada" | "retenida" | "emitida" | "vencida" | "cancelada" | "error";

export interface ExternalOffer {
  id: string;
  provider: string;
  kind: ExternalOfferKind;
  kind_label: string;
  offer_ref: string;
  summary: string;
  net_amount: string;
  sell_amount: string;
  currency: string;
  offer_expires_at: string | null;
  pnr: string | null;
  status: ExternalOfferStatus;
  status_label: string;
  can_hold: boolean;
  can_remove: boolean;
}

export interface ExternalOfferResult {
  provider: string;
  kind: ExternalOfferKind;
  kind_label: string;
  offer_ref: string;
  summary: string;
  net_amount: string;
  sell_amount: string;
  currency: string;
  offer_expires_at: string;
  payload: { refundable?: boolean; units?: number };
}

export interface ExternalOfferState {
  code: string;
  status: string;
  currency: string;
  travel_from: string | null;
  travel_to: string | null;
  pax_adt: number;
  pax_chd: number;
  pax_inf: number;
  editable: boolean;
  rule_enabled: boolean;
  available: boolean;
  unavailable_message: string | null;
  external_offers: ExternalOffer[];
  external_total: string;
  results?: ExternalOfferResult[];
}

export const OFFER_KINDS: { value: ExternalOfferKind; label: string }[] = [
  { value: "aereo", label: "Aéreo" },
  { value: "hotel", label: "Hotel" },
  { value: "auto", label: "Auto" },
  { value: "seguro", label: "Seguro" },
];

export const OFFER_STATUS_TONE: Record<ExternalOfferStatus, Tone> = { cotizada: "info", retenida: "violet", emitida: "ok", vencida: "warn", cancelada: "mute", error: "bad" };

export const PROVIDER_LABEL: Record<string, string> = { amadeus: "Amadeus", sabre: "Sabre", travelport: "Travelport", hotelbeds: "Hotelbeds", otro: "Otro proveedor" };

export function offerExpiry(iso: string | null, now: Date = new Date()): { label: string; tone: Tone } | null {
  if (!iso) return null;
  const minutes = Math.floor((new Date(iso).getTime() - now.getTime()) / 60000);
  if (Number.isNaN(minutes)) return null;
  if (minutes < 0) return { label: "Venció", tone: "bad" };
  if (minutes < 60) return { label: minutes <= 1 ? "Vence en 1 min" : `Vence en ${minutes} min`, tone: minutes <= 10 ? "bad" : "warn" };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { label: hours === 1 ? "Vence en 1 h" : `Vence en ${hours} h`, tone: hours < 6 ? "warn" : "mute" };
  const days = Math.floor(hours / 24);
  return { label: `Vence en ${days} días`, tone: "mute" };
}

export function pendingIssue(offers: ExternalOffer[]): { count: number; blocked: number } {
  return {
    count: offers.filter((offer) => offer.status === "cotizada" || offer.status === "retenida").length,
    blocked: offers.filter((offer) => offer.status === "vencida" || offer.status === "error").length,
  };
}

export function offerTotal(base: string | number, offers: ExternalOffer[]): string {
  const cents = offers
    .filter((offer) => offer.status === "cotizada" || offer.status === "retenida" || offer.status === "emitida")
    .reduce((sum, offer) => sum + Math.round(Number(offer.sell_amount) * 100), Math.round(Number(base) * 100));
  return (cents / 100).toFixed(2);
}
