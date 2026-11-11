import type { Tone } from "./tone";

export type HelpOrigin = "qhapaq" | "adaptado" | "propio";

export type HelpAudience = "agency" | "platform";

export type HelpStatus = "published" | "archived";

export interface HelpStep {
  title: string;
  text: string;
}

export interface HelpFaq {
  question: string;
  answer: string;
}

export interface HelpArticleSummary {
  slug: string;
  audience: HelpAudience;
  module: string;
  screen: string;
  title: string;
  summary: string;
  roles: string[];
  steps_count: number;
  faqs_count: number;
  status: HelpStatus;
  origin: HelpOrigin;
  origin_label: string;
  sort_order: number;
  updated_at: string;
  adaptations?: number;
}

export interface HelpHistoryEntry {
  code: number;
  action: string;
  before: string | null;
  after: string | null;
  actor: string | null;
  at: string;
}

export interface HelpOptions {
  modules: string[];
  platform_modules?: string[];
  screens: string[];
  roles: { value: string; label: string }[];
  audiences?: { value: HelpAudience; label: string }[];
}

export interface HelpArticle extends HelpArticleSummary {
  steps: HelpStep[];
  faqs: HelpFaq[];
  keywords: string[];
  lock_version: number;
  related: HelpArticleSummary[];
  has_original: boolean;
  can_manage: boolean;
  history: HelpHistoryEntry[];
  options: HelpOptions | null;
}

export interface HelpIndex {
  articles: HelpArticleSummary[];
  modules: { module: string; count: number }[];
  counts: Record<string, number>;
  can_manage: boolean;
  filters: { q: string; module: string; status: string; audience?: string };
  options: HelpOptions | null;
}

export interface HelpScreen {
  path: string;
  article: (HelpArticleSummary & { steps: HelpStep[]; faqs: HelpFaq[]; keywords: string[]; lock_version: number }) | null;
  more: HelpArticleSummary[];
  related: HelpArticleSummary[];
  can_manage: boolean;
}

export interface HelpRealm {
  centerHref: string;
  screenUrl: string;
  platform: boolean;
}

export const AGENCY_HELP: HelpRealm = { centerHref: "/ayuda", screenUrl: "/ayuda/pantalla", platform: false };

export const PLATFORM_HELP: HelpRealm = { centerHref: "/plataforma/ayuda", screenUrl: "/plataforma/ayuda/pantalla", platform: true };

export const ORIGIN_TONES: Record<HelpOrigin, Tone> = { qhapaq: "info", adaptado: "violet", propio: "sun" };

export const HELP_ACTIONS: Record<string, string> = {
  crear: "Creó el artículo",
  editar: "Editó el artículo",
  adaptar: "Adaptó la versión de Qhapaq",
  archivar: "Archivó el artículo",
  reactivar: "Reactivó el artículo",
  restaurar_original: "Volvió a la versión de Qhapaq",
};

export function helpHref(realm: HelpRealm, slug: string, edit = false): string {
  return `${realm.centerHref}/${encodeURIComponent(slug)}${edit ? "?editar=1" : ""}`;
}

export function helpQuery(filters: { q?: string; module?: string; status?: string; audience?: string }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function splitKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function parseList(raw: FormDataEntryValue | null): Record<string, string>[] {
  try {
    const parsed: unknown = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(parsed) ? (parsed as Record<string, string>[]) : [];
  } catch {
    return [];
  }
}

export function helpPayload(form: FormData): Record<string, unknown> {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const payload: Record<string, unknown> = {
    title: text("title"),
    module: text("module"),
    screen: text("screen"),
    summary: text("summary"),
    steps: parseList(form.get("steps")),
    faqs: parseList(form.get("faqs")),
    keywords: splitKeywords(text("keywords")),
    roles: form.getAll("roles").map(String),
  };
  if (form.has("audience")) payload.audience = text("audience");
  if (form.has("lock_version")) payload.lock_version = Number(form.get("lock_version"));
  return payload;
}

export function lockOf(form: FormData): Record<string, unknown> {
  return { lock_version: Number(form.get("lock_version") ?? 0) };
}

export function groupByModule<T extends { module: string }>(items: T[], order: string[]): { module: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.module, [...(groups.get(item.module) ?? []), item]);
  const rank = (module: string) => (order.indexOf(module) === -1 ? Number.MAX_SAFE_INTEGER : order.indexOf(module));
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([module, grouped]) => ({ module, items: grouped }));
}
