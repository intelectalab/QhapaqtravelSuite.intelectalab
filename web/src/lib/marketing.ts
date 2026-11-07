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

export interface Segment {
  code: string;
  name: string;
  description: string | null;
  match: "all" | "any";
  rules_text: string;
  matched: number;
  email: number;
  whatsapp: number;
  campaigns: number;
}

export interface MarketingTemplate {
  code: string;
  name: string;
  channel: "email" | "whatsapp";
  category: string;
  status: string;
  subject: string | null;
  body: string;
  usable: boolean;
}

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
  kpis: { sent_90: number; open_rate: number | null; click_rate: number | null; revenue: number; reservations: number; contactable_email: number; contactable_whatsapp: number; contacts: number };
  campaigns: Campaign[];
  segments: Segment[];
  templates: MarketingTemplate[];
  codes: PromoCode[];
  consents: { email: number; whatsapp: number; revoked_30: number; subscribers: number };
  can: { manage: boolean };
}

export const rate = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
