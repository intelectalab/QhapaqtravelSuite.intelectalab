export type LeadStatus = "nuevo" | "contactado" | "calificado" | "convertido" | "duplicado" | "descartado";

export interface LeadRow {
  code: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  channel: string;
  interest: string;
  destination: string | null;
  travel_date: string | null;
  pax: number;
  score: number;
  status: LeadStatus;
  lock_version: number;
  codes: { source: string; channel: string; interest: string };
  owner_id: string | null;
  owner: { name: string; color: string | null } | null;
  created_at: string;
}

export interface LeadDetail extends LeadRow {
  notes: string | null;
  bant: { budget: number; authority: number; need: number; timeline: number; score: number; declared_amount: string | null; currency: string | null; notes: string | null; qualified_at: string } | null;
  validated_at: string | null;
  assigned_at: string | null;
  first_contact_at: string | null;
  discard_reason: string | null;
  discard_detail: string | null;
  discarded_at: string | null;
  duplicate_of: { code: string; name: string } | null;
  converted: {
    at: string | null;
    client: { code: string; name: string };
    opportunity: { code: string; title: string; stage: string; amount: string; currency: string } | null;
  } | null;
}

export function scoreTone(score: number): "ok" | "sun" | "mute" {
  return score >= 70 ? "ok" : score >= 40 ? "sun" : "mute";
}

export interface CatalogItem {
  code: string;
  label: string;
  requires_detail: boolean;
}

export type CrmCatalogs = Record<"lead_source" | "lead_channel" | "lead_interest" | "client_segment" | "activity_type" | "discard_reason" | "lost_reason", CatalogItem[]>;

export interface DuplicateMatch {
  type: "lead" | "client";
  code: string;
  name: string;
  status: string;
}

export const BANT_LEVELS = [
  { value: "0", label: "No" },
  { value: "10", label: "Poco" },
  { value: "18", label: "Bastante" },
  { value: "25", label: "Sí, claramente" },
];

export interface Advisor {
  id: string;
  name: string;
  color: string | null;
}
