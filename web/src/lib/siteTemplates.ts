import type { Tone } from "@/lib/tone";

export type TemplateCategory = "agencia" | "free_tour" | "aventura" | "lujo" | "corporativo" | "multi";
export type TemplateTier = "incluida" | "premium";
export type TemplateStatus = "borrador" | "en_revision" | "publicado" | "retirado";

export interface TemplateTokens {
  side?: string;
  accent?: string;
  soft?: string;
  sun?: string;
  radius?: number;
}

export interface Lighthouse {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  best_practices: number | null;
  measured: boolean;
}

export interface SiteTemplate {
  code: string;
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  category_label: string;
  tier: TemplateTier;
  price: string;
  currency: string;
  min_plan: { code: string; name: string } | null;
  author: { kind: "equipo" | "partner"; name: string };
  repo_url: string | null;
  status: TemplateStatus;
  status_label: string;
  is_default: boolean;
  installs: number;
  tags: string[];
  version: string | null;
  lighthouse: Lighthouse | null;
  sections: string[];
  tokens: TemplateTokens;
  site_style: "actual" | "andes" | null;
  available: boolean;
}

export interface GalleryTemplate extends SiteTemplate {
  purchased: boolean;
  plan_allowed: boolean;
  is_active: boolean;
}

export interface ThemeSection {
  id: string;
  visible: boolean;
}

export interface ThemeHistoryItem {
  id: string;
  template: { code: string; name: string; status: TemplateStatus } | null;
  version: string | null;
  chosen_by: string;
  chosen_by_label: string;
  applied_at: string | null;
  applied_by: string | null;
  until: string | null;
  can_restore: boolean;
}

export interface ThemeOverview {
  active: {
    id: string | null;
    template: SiteTemplate;
    version: string | null;
    chosen_by: string;
    chosen_by_label: string;
    applied_at: string | null;
    applied_by: string | null;
    update_available: string | null;
  } | null;
  lock_version: number;
  subdomain: string;
  tokens: { side: string; accent: string; sun: string; radius: number; sections: ThemeSection[] };
  site_style: string;
  history: ThemeHistoryItem[];
  purchased: string[];
  plan: { code: string; name: string; rank: number } | null;
  catalog: { categories: Record<TemplateCategory, string>; corner_px: Record<string, number>; min_contrast: number; radius_max: number };
}

export type AiKind = "mejorar_texto" | "meta_seo" | "traducir" | "relato_aventura" | "articulo" | "imagen";
export type AiStatus = "en_cola" | "procesando" | "listo" | "aplicado" | "descartado" | "fallido";
export type AiTargetType = "producto" | "pagina" | "historia" | "libre";

export interface AiTarget {
  id: string;
  code: string;
  label: string;
}

export interface AiOptions {
  kinds: Record<AiKind, string>;
  kind_targets: Record<Exclude<AiKind, "imagen">, AiTargetType[]>;
  tones: Record<string, string>;
  locales: Record<string, string>;
  styles: Record<string, string>;
  qualities: Record<string, number>;
  image_counts: number[];
  image_uses: string[];
  statuses: Record<AiStatus, string>;
  targets: Record<"producto" | "pagina" | "historia", AiTarget[]>;
}

export interface AiImage {
  id: string;
  job: string | null;
  prompt: string;
  style: string;
  style_label: string;
  width: number;
  height: number;
  hd: boolean;
  alt_text: string;
  ai_label: boolean;
  credits_used: number;
  status: "generada" | "en_uso" | "descartada";
  used_in: string[];
  file: string;
  created_at: string;
}

export interface AiJob {
  code: string;
  kind: AiKind;
  kind_label: string;
  target_type: AiTargetType;
  target_id: string | null;
  target_label: string;
  locale: string;
  tone: string | null;
  status: AiStatus;
  status_label: string;
  credits_used: number;
  cost: number;
  error: string | null;
  created_by: string | null;
  created_at: string;
  applied_at: string | null;
  notes?: string | null;
  before?: { text?: string; title?: string; desc?: string } | null;
  after?: { text?: string; title?: string; desc?: string } | null;
  applied_ref?: string | null;
  warning?: string | null;
  images?: AiImage[];
}

export interface AiBalance {
  balance: number;
  used_month: number;
  granted_month: number;
  low: boolean;
}

export interface AiPack {
  code: string;
  name: string;
  kind: "contenido" | "imagenes";
  kind_label: string;
  credits: number;
  image_bonus: number;
  price: string;
  currency: string;
  billing: "unico" | "mensual";
  addon_code: string | null;
  is_plan: boolean;
  active: boolean;
}

export interface AiCreditsSummary {
  balances: Record<"contenido" | "imagenes", AiBalance>;
  plan_included: Record<"contenido" | "imagenes", number>;
  ai_plan: AiPack | null;
  costs: Record<string, number>;
}

export interface AiLedgerRow {
  id: string;
  kind: "contenido" | "imagenes";
  kind_label: string;
  movement: string;
  movement_label: string;
  credits: number;
  balance_after: number;
  pack: string | null;
  job: string | null;
  note: string | null;
  occurred_at: string;
}

export interface AiPacksOverview {
  plans: AiPack[];
  packs: AiPack[];
  contracted: string | null;
  plan_included: Record<"contenido" | "imagenes", number>;
}

export interface TemplateVersion {
  id: string;
  version: string;
  status: "candidata" | "aprobada" | "publicada" | "retirada";
  changelog: string | null;
  lighthouse: Lighthouse;
  sections: string[];
  published_at: string | null;
}

export interface TemplateAssignment {
  tenant: { id: string; code: string; name: string };
  template: { code: string; name: string; tier: TemplateTier } | null;
  version: string | null;
  chosen_by: string;
  chosen_by_label: string;
  applied_at: string | null;
  update_available: string | null;
}

export interface TemplateSubmission {
  code: string;
  template: { code: string; name: string; slug: string } | null;
  version: string;
  submitted_by: string;
  status: "recibida" | "validando" | "aprobada" | "rechazada";
  status_label: string;
  checks: Record<string, string | Partial<Record<keyof typeof LIGHTHOUSE_MIN, number>>>;
  lighthouse_ok: boolean;
  reviewer: string | null;
  reject_reason: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface TemplatesAdminOverview {
  templates: (SiteTemplate & { versions: TemplateVersion[] })[];
  assignments: TemplateAssignment[];
  plans: { code: string; name: string }[];
  kpis: { published: number; total: number; available: number; pending_submissions: number; agencies: number; agencies_self: number; premium_sales: number; premium_amount: string };
  catalog: { categories: Record<TemplateCategory, string>; tiers: Record<TemplateTier, string>; statuses: Record<TemplateStatus, string>; checks: Record<string, string>; lighthouse_min: typeof LIGHTHOUSE_MIN; sections: string[]; pages: string[]; site_styles: Record<string, string> };
}

export const LIGHTHOUSE_MIN = { performance: 85, accessibility: 95, seo: 95, best_practices: 90 } as const;

export const LIGHTHOUSE_LABELS: Record<keyof typeof LIGHTHOUSE_MIN, string> = { performance: "Rendimiento", accessibility: "Accesibilidad", seo: "SEO", best_practices: "Buenas prácticas" };

export const AI_STATUS_TONE: Record<AiStatus, Tone> = { en_cola: "mute", procesando: "info", listo: "sun", aplicado: "ok", descartado: "mute", fallido: "bad" };

export const SUBMISSION_TONE: Record<TemplateSubmission["status"], Tone> = { recibida: "info", validando: "sun", aprobada: "ok", rechazada: "bad" };

export const TEMPLATE_STATUS_TONE: Record<TemplateStatus, Tone> = { borrador: "mute", en_revision: "sun", publicado: "ok", retirado: "bad" };

export function sectionLabel(section: string): string {
  const text = section.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function templatePrice(template: Pick<SiteTemplate, "tier" | "price" | "currency">): string {
  return template.tier === "premium" ? `${template.currency === "PEN" ? "S/" : template.currency} ${Number(template.price).toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : "Incluida";
}
