export interface CampaignAudience {
  matched: number;
  eligible: number;
  optout: number;
  nodata: number;
  consent: number;
  fatigue?: number;
}

export interface Campaign {
  code: string;
  lock_version: number;
  name: string;
  channel: "email" | "whatsapp";
  channel_label: string;
  status: "borrador" | "programada" | "enviando" | "enviada" | "cancelada";
  status_label: string;
  segment: { code: string; name: string } | null;
  template: { code: string; name: string; status: string } | null;
  subject: string | null;
  body: string;
  promo_code: string | null;
  utm: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  cancel_reason: string | null;
  owner: string | null;
  audience: CampaignAudience | null;
  tests: { to: string; at: string }[];
  metrics: { recipients: number; delivered: number; opened: number; clicked: number; replied: number; unsubscribed: number; failed: number };
  attribution: { reservations: number; revenue: number; items: { code: string; title: string; total_pen: number }[] };
}

export interface SegmentRule {
  f: string;
  op: string;
  v: string | number | null;
}

export interface SegmentField {
  field: string;
  label: string;
  kind: "choice" | "number" | "text";
  ops: { value: string; label: string; needs_value: boolean }[];
  values: { value: string; label: string }[];
}

export interface Segment {
  code: string;
  lock_version: number;
  name: string;
  description: string | null;
  match: "all" | "any";
  rules: SegmentRule[];
  rules_text: string;
  rules_parts?: string[];
  matched: number;
  email: number;
  whatsapp: number;
  campaigns: number;
  owner: string | null;
  updated_at: string;
}

export interface SegmentPreview {
  matched: number;
  by_type: { type: string; label: string; count: number }[];
  email: CampaignAudience;
  whatsapp: CampaignAudience;
  rules_text: string;
  sample: { key: string; code: string; name: string; type_label: string; email: string | null; mobile: string | null; consent: { email: boolean; whatsapp: boolean }; revoked: { email: boolean; whatsapp: boolean } }[];
}

export type TemplateCategory = "MARKETING" | "UTILITY" | "SERVICIO";

export interface MarketingTemplate {
  code: string;
  lock_version: number;
  name: string;
  channel: "email" | "whatsapp";
  category: TemplateCategory;
  category_label: string;
  status: "activa" | "en_revision" | "aprobada" | "rechazada";
  subject: string | null;
  body: string;
  provider_template_id: string | null;
  reviewed_at: string | null;
  updated_at: string;
  uses: number;
  usable: boolean;
}

export const TEMPLATE_STATUS: Record<MarketingTemplate["status"], { label: string; tone: "ok" | "sun" | "bad" | "info" }> = {
  activa: { label: "Activa", tone: "ok" },
  en_revision: { label: "En revisión de Meta", tone: "sun" },
  aprobada: { label: "Aprobada por Meta", tone: "info" },
  rechazada: { label: "Rechazada por Meta", tone: "bad" },
};

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "MARKETING", label: "Comercial" },
  { value: "UTILITY", label: "Utilidad" },
  { value: "SERVICIO", label: "Servicio" },
];

export const SAMPLE_VARIABLES: Record<string, string> = {
  nombre: "Andrea",
  destino: "Cusco",
  asesor: "Mariela Quispe",
  codigo_promo: "PRIMAVERA8",
  fecha_viaje: "14/12/2026",
  agencia: "tu agencia",
  enlace_baja: "enlace de baja",
};

export const fillVariables = (text: string, values: Record<string, string> = SAMPLE_VARIABLES) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key] ?? match);

export const suppressedOf = (audience: CampaignAudience) => audience.optout + audience.nodata + audience.consent + (audience.fatigue ?? 0);

export interface PromoCode {
  code: string;
  product: string | null;
  kind: string | null;
  value: number | null;
  valid_to: string | null;
  status: string | null;
  campaigns: { code: string; name: string; status: string }[];
}

export interface MarketingOverview {
  kpis: { sent_90: number; recipients_90: number; delivered_90: number; open_rate: number | null; click_rate: number | null; revenue: number; reservations: number; contactable_email: number; contactable_whatsapp: number; contacts: number };
  campaigns: Campaign[];
  segments: Segment[];
  templates: MarketingTemplate[];
  codes: PromoCode[];
  segment_fields: SegmentField[];
  variables: string[];
  consents: { email: number; whatsapp: number; revoked_30: number; subscribers: number };
  can: { manage: boolean };
}

export const rate = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

export interface AutomationQueueItem {
  name: string;
  type_label: string;
  why: string;
  block: string | null;
}

export interface Automation {
  code: string;
  key: "welcome" | "cart" | "pretrip" | "survey" | "birthday" | "reactivation";
  lock_version: number;
  name: string;
  trigger: string;
  delay: string;
  channel: "email" | "whatsapp";
  channel_label: string;
  purpose: "comercial" | "servicio";
  purpose_label: string;
  status: "activa" | "pausada";
  template: { code: string; name: string; status: string; usable: boolean } | null;
  totals: { sent: number; suppressed: number; conversions: number };
  queue: { total: number; sendable: number; suppressed: number; items: AutomationQueueItem[] };
  last_run: { at: string; queued: number; sent: number; suppressed: number; by: string | null } | null;
  history: { action: string; label: string; detail: string | null; at: string; by: string | null }[];
  updated_at: string;
}

export interface AutomationsOverview {
  automations: Automation[];
  templates: { code: string; name: string; channel: "email" | "whatsapp"; usable: boolean }[];
  can: { manage: boolean };
}

export interface ConsentRecord {
  code: string;
  lock_version: number;
  channel: "email" | "whatsapp";
  status: "otorgado" | "revocado";
  granted_at: string;
  source: string;
  evidence: string;
  policy_version: string;
  revoked_at: string | null;
  revoke_source: string | null;
  revoke_campaign: string | null;
}

export interface ConsentEvent {
  consent_code: string;
  channel: "email" | "whatsapp";
  event: "otorgado" | "revocado";
  source: string;
  evidence: string | null;
  occurred_at: string;
  actor: string | null;
}

export interface MarketingContact {
  key: string;
  type: "client" | "lead" | "subscriber";
  type_label: string;
  id: string;
  code: string;
  name: string;
  email: string | null;
  mobile: string | null;
  href: string | null;
  email_consent: ConsentRecord | null;
  whatsapp_consent: ConsentRecord | null;
  history: ConsentEvent[];
}

export interface ConsentsOverview {
  contacts: MarketingContact[];
  sources: { grant: string[]; revoke: string[]; policy_version: string };
  can: { manage: boolean };
}

export type ConsentChannel = "email" | "whatsapp";

export const CHANNEL_LABELS: Record<ConsentChannel, string> = { email: "Email", whatsapp: "WhatsApp" };

export const consentOf = (contact: MarketingContact, channel: ConsentChannel) => (channel === "email" ? contact.email_consent : contact.whatsapp_consent);

export const addressOf = (contact: MarketingContact, channel: ConsentChannel) => (channel === "email" ? contact.email : contact.mobile);
