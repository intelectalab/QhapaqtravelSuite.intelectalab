import type { ShowcaseListing } from "@/lib/vitrina";

export interface RlCity {
  id: string;
  tours: number;
  zones: number;
  rating: number | null;
}

export interface RlOverview {
  brand: { name: string; domain: string };
  cities: RlCity[];
  themes: string[];
  stats: { month_visits: number; month_bookings: number; agencies: number; cities: number; tours: number };
  rules: { free_monthly_bookings: number; fee_per_attendee: string; fee_currency: string; commission_pct: Record<string, string> };
  benefits: [string, string][];
  plans: { code: string; name: string; price_month: string; currency: string; commission_pct: string }[];
  pass: { days: number; price: string; currency: string };
  addons: { code: string; label: string; billing_mode: "mensual" | "unico" | "ambos"; price_once: string | null; price_month: string | null }[];
}

export interface RlListings {
  items: ShowcaseListing[];
  cities: string[];
  themes: string[];
  brand: { name: string; domain: string };
}

export interface RlListingDetail extends ShowcaseListing {
  attendance_rate: number | null;
  agency_site: string | null;
  booking_rules: { max_pax: number; free: boolean };
}

export interface RlPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string | null;
  city: string | null;
  focus_keyword: string;
  word_count: number;
  published_at: string | null;
  author: string | null;
  updated_at: string;
  tours?: ShowcaseListing[];
}

export interface RlBooking {
  code: string;
  cancel_token: string;
  status: string;
  listing: { code: string; title: string };
  date: string;
  time: string;
  pax: number;
  free: boolean;
  amount: string | null;
  currency: string;
}

export interface RlFormResult {
  ok: boolean;
  message: string | null;
  fields?: Record<string, string>;
}

export const RL_LANGUAGES: Record<string, string> = { es: "Español", en: "Inglés", pt: "Portugués", fr: "Francés", de: "Alemán", it: "Italiano" };

const GRADIENTS: Record<string, string> = {
  lima: "radial-gradient(circle at 78% 28%, rgba(249,87,56,.75), transparent 46%), linear-gradient(170deg, #1D4ED8 0%, #1E3A8A 55%, #0F172A 100%)",
  cusco: "radial-gradient(circle at 25% 22%, rgba(133,248,196,.55), transparent 48%), linear-gradient(160deg, #059669 0%, #065F46 50%, #0F172A 100%)",
  arequipa: "radial-gradient(circle at 70% 18%, rgba(255,255,255,.55), transparent 40%), linear-gradient(165deg, #60A5FA 0%, #1D4ED8 55%, #1E3A8A 100%)",
  puno: "radial-gradient(circle at 30% 80%, rgba(56,189,248,.55), transparent 50%), linear-gradient(170deg, #0369A1 0%, #1E3A8A 60%, #0F172A 100%)",
};

const FALLBACK = [
  "radial-gradient(circle at 70% 25%, rgba(249,87,56,.55), transparent 45%), linear-gradient(165deg, #334155 0%, #1E293B 60%, #0F172A 100%)",
  "radial-gradient(circle at 25% 30%, rgba(133,248,196,.45), transparent 45%), linear-gradient(165deg, #0F766E 0%, #134E4A 60%, #0F172A 100%)",
  "radial-gradient(circle at 60% 20%, rgba(183,196,255,.6), transparent 45%), linear-gradient(165deg, #4338CA 0%, #1E3A8A 60%, #0F172A 100%)",
];

export function cityGradient(city: string | null | undefined): string {
  if (!city) return FALLBACK[0];
  if (GRADIENTS[city]) return GRADIENTS[city];
  const index = [...city].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FALLBACK.length;
  return FALLBACK[index];
}

export function cityName(city: string): string {
  return city
    .split(/[-\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function rlPath(base: string, path = ""): string {
  const full = `${base}${path}`;
  return full === "" ? "/" : full.startsWith("?") || full.startsWith("#") ? `/${full}` : full;
}

export function readMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}

export function turnOf(time: string): "manana" | "tarde" | "noche" {
  return time < "12:00" ? "manana" : time < "18:00" ? "tarde" : "noche";
}

export const TURN_LABELS: Record<string, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };
