import type { SiteBannerData, SiteDesign } from "@/lib/site-design";

export interface Money {
  amount: number;
  currency: string;
}

export interface Option {
  value: string;
  label: string;
  count?: number;
}

export interface SiteSede {
  id: string;
  name: string;
  city: string | null;
  address: string;
  phone: string | null;
  is_main: boolean;
}

export interface SiteProfile {
  agency: {
    subdomain: string;
    name: string;
    legal_name: string;
    ruc: string;
    initials: string;
    logo: string | null;
    address: string;
    phone: string | null;
    email: string | null;
    web: string | null;
    registry: string | null;
  };
  branding: { brand: string; accent: string; menu: string };
  design: SiteDesign;
  preview?: boolean;
  sedes: SiteSede[];
  fx: { rate: number; date: string } | null;
  banner: SiteBannerData | null;
  policies: { cancel: string | null; modify: string | null; refund: string | null; hold_minutes: number };
  claims_days: number;
}

export interface Rating {
  avg: number;
  count: number;
  verified: boolean;
}

export interface Departure {
  ref: string;
  date: string;
  time: string;
  capacity: number;
  sold: number;
  spots: number;
  guaranteed: boolean;
  meeting_point: string;
  status: string;
  price?: Money | null;
  bookable?: boolean;
  product?: { slug: string; name: string; destination: string };
}

export interface Promotion {
  name: string;
  kind: string;
  value: number;
  percent: boolean;
  code: string | null;
  min_pax: number | null;
  ends_at: string;
}

export interface SeasonTag {
  name: string;
  type?: string;
  factor: number;
  level: "alta" | "media" | "baja" | "especial";
}

export interface ProductCard {
  slug: string;
  name: string;
  summary: string | null;
  type: string;
  kind: string;
  category: string;
  destination: { name: string; slug: string | null };
  duration: string;
  days: number;
  modality: string;
  difficulty: string | null;
  languages: string[];
  rating: Rating | null;
  from: Money | null;
  list: number | null;
  first_date: string | null;
  next_departure: Departure | null;
  daily: boolean;
  featured: boolean;
  tags: { key: string; label: string }[];
  on_date?: { date: string; spots: number | null; season: SeasonTag | null };
  promotion?: Promotion | null;
  content_locale?: string;
}

export interface DestinationCard {
  slug: string;
  name: string;
  tagline: string | null;
  altitude: string | null;
  type: string;
  count: number;
  from: Money | null;
  content_locale?: string;
}

export interface Review {
  author: string;
  country: string | null;
  date: string;
  stars: number;
  title: string | null;
  body: string | null;
  reply: string | null;
  lang: string;
  source: string;
  verified: boolean;
  product: { name: string; slug: string } | null;
}

export interface ReviewBlock {
  average: number | null;
  count: number;
  verified: number;
  distribution: Record<string, number>;
  items: Review[];
}

export interface HomeData {
  search: { destinations: Option[]; kinds: Option[] };
  destinations: DestinationCard[];
  featured: ProductCard[];
  offers: ProductCard[];
  departures: Departure[];
  reviews: ReviewBlock;
  stats: { products: number; destinations: number; departures: number };
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  published_at: string | null;
  author: string | null;
  minutes: number;
}

export interface PostDetail extends PostSummary {
  body: string;
  seo: { title: string | null; description: string | null };
  related: PostSummary[];
}

export interface SitePage {
  slug: string;
  title: string;
  type: string;
  body: string;
  source: "cms" | "agency";
  updated_at: string | null;
  seo: { title: string | null; description: string | null };
}

export interface AboutData {
  slug: "nosotros";
  body: string | null;
  stats: { products: number; destinations: number; trips: number; rating: { avg: number; count: number } | null };
}

export interface OffersData {
  offers: ProductCard[];
  codes: { code: string; name: string; value: number; percent: boolean; ends_at: string; product: { slug: string; name: string } }[];
  departures: Departure[];
}

export interface DestinationDetail {
  destination: DestinationCard & {
    description: string | null;
    climate: string | null;
    lat: number | null;
    lng: number | null;
    faqs: { q: string; a: string }[];
    region: string;
  };
  months: { month: string; season: { name: string; level: SeasonTag["level"]; factor: number } | null }[];
  special: { name: string; from: string; to: string; factor: number }[];
  products: ProductCard[];
  reviews: ReviewBlock;
}

export interface ListingFacets {
  destinations: Option[];
  kinds: Option[];
  categories: Option[];
  difficulties: Option[];
  languages: Option[];
  modalities: Option[];
  durations: Option[];
  sorts: Option[];
}

export interface ListingData {
  items: ProductCard[];
  total: number;
  destination: { slug: string; name: string } | null;
  facets: ListingFacets;
  fx: number;
}

export interface CalendarDay {
  date: string;
  status: string;
  label: string;
  sellable: boolean;
  price: number | null;
  child: number | null;
  list: number | null;
  currency: string | null;
  season: SeasonTag | null;
  spots: number | null;
  time: string | null;
  note: string | null;
}

export interface CalendarMonth {
  month: string;
  pax: number;
  days: CalendarDay[];
  min: number | null;
  currency: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  items: { time: string | null; activity: string; type: string | null; location: string | null }[];
}

export interface ProductDetail {
  product: ProductCard & {
    description: string | null;
    seo: { title: string; description: string | null };
    pickup: string | null;
    group: { min: number; max: number };
    ages: { min: number; max: number; children: boolean; infants: boolean };
    advance_days: number;
    breadcrumbs: { name: string; slug: string }[];
    promotions: Promotion[];
    media: { url: string; alt: string }[];
  };
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  requirements: { category: string | null; text: string }[];
  policies: Record<string, string>;
  faqs: { q: string; a: string }[];
  departures: Departure[];
  calendar: CalendarMonth[];
  reviews: ReviewBlock;
  related: ProductCard[];
}

export interface QuoteLine {
  key: string;
  label: string;
  qty: number;
  unit: string;
  amount: string;
}

export interface Quote {
  date: string;
  currency: string;
  season: SeasonTag | null;
  lines: QuoteLine[];
  subtotal: string;
  discount: { label: string; amount: string; code: string | null } | null;
  total: string;
  list_total: string | null;
  spots: number | null;
  departure: Departure | null;
  pax: { adults: number; children: number; infants: number };
}

export interface FormOptions {
  sedes: Option[];
  search: { destinations: Option[]; kinds: Option[] };
}

export interface SiteFormState {
  status: "idle" | "error" | "done";
  message?: string;
  errors?: Record<string, string>;
  data?: Record<string, unknown>;
}

export const IDLE: SiteFormState = { status: "idle" };

export const LISTING_KEYS = ["destino", "tipo", "fecha", "viajeros", "duracion", "precio_min", "precio_max", "categoria", "dificultad", "idioma", "modalidad", "orden", "q"] as const;

export type ListingKey = (typeof LISTING_KEYS)[number];

export const SEASON_LABEL: Record<SeasonTag["level"], string> = {
  alta: "Temporada alta",
  media: "Temporada media",
  baja: "Temporada baja",
  especial: "Fecha especial",
};

export const SEASON_TONE: Record<SeasonTag["level"], "t3" | "t1" | "t4" | "t2"> = {
  alta: "t3",
  media: "t1",
  baja: "t4",
  especial: "t2",
};

export const LANGUAGE_LABEL: Record<string, string> = { ES: "Español", EN: "Inglés", DE: "Alemán", FR: "Francés", PT: "Portugués", IT: "Italiano" };

export function siteHref(base: string, path = ""): string {
  const clean = path.startsWith("/") || path === "" ? path : `/${path}`;
  return `${base}${clean}` || "/";
}

export function hueFor(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function listingQuery(params: Partial<Record<ListingKey, string>>): string {
  const query = new URLSearchParams();
  for (const key of LISTING_KEYS) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function pickListing(search: Record<string, string | string[] | undefined>): Partial<Record<ListingKey, string>> {
  const picked: Partial<Record<ListingKey, string>> = {};
  for (const key of LISTING_KEYS) {
    const value = search[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) picked[key] = single;
  }
  return picked;
}

export function daysUntil(iso: string, from = new Date()): number {
  const target = new Date(`${iso}T23:59:59-05:00`).getTime();
  return Math.max(0, Math.ceil((target - from.getTime()) / 86_400_000));
}

export interface CartLine {
  line: number;
  product: { slug: string; name: string };
  date: string;
  pax: { adults: number; children: number; infants: number };
  quote: Omit<Quote, "pax"> | null;
  error: string | null;
  cancellation: string | null;
  hold: { ref: string; status: "hold" | "expirada"; expires_at: string } | null;
}

export interface SiteCart {
  code: string | null;
  promo: string | null;
  items: CartLine[];
  totals: { currency: string; subtotal: string; discount: string; total: string }[];
  hold_minutes: number;
  fx: number;
}

export interface CheckoutTerms {
  currency: string;
  total: string;
  modes: { value: "total" | "adelanto"; label: string; amount: string; balance?: string; balance_due?: string; pct?: number }[];
  adelanto_unavailable: string | null;
  methods: { value: string; label: string }[];
  bank_accounts: { bank: string | null; name: string; currency: string; account_number: string; cci: string | null }[];
  group: { adt: number; chd: number; inf: number };
  first_date: string;
  companions: { when: string; require_document: boolean };
  items: {
    line: number;
    product: { id: string; slug: string; name: string; min_age: number };
    date: string;
    pax: { adt: number; chd: number; inf: number };
    total: string;
    deposit_pct: number;
    deposit: string;
    balance_due: string;
    payment_note: string | null;
    pickup: { points: { label: string; kind: string; requires_address: boolean }[]; ask_flight: boolean; text: string | null } | null;
    comments: number | null;
    cancellation: { text: string; tiers: string } | null;
  }[];
}

export const TEST_CARDS: Record<string, "ok" | "51"> = { "4111111111111111": "ok", "5555555555554444": "ok", "378282246310005": "ok", "36227206271667": "ok", "4000000000000002": "51" };

export function tokenizeCard(raw: string): { token: string; masked: string; valid: boolean } {
  const digits = raw.replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const valid = digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
  const last4 = digits.slice(-4).padStart(4, "0");
  const code = TEST_CARDS[digits] ?? "14";
  return { token: `tok_${code}_${last4}`, masked: `•••• ${last4}`, valid };
}

export interface SiteOrder {
  code: string;
  status: string;
  ordered_at: string;
  customer: { name: string; email: string };
  total: string;
  discount: string;
  currency: string;
  hold_expires_at: string | null;
  pay_mode: "total" | "anticipo";
  deposit_pct: number;
  amount_due_now: string;
  balance_due_date: string | null;
  due: string;
  methods: { value: string; label: string }[];
  bank_accounts: CheckoutTerms["bank_accounts"];
  passengers: { name: string; type: string }[];
  attempts: { at: string; method: string; card: string | null; operation: string | null; result: "aprobado" | "rechazado" | "por_validar"; code: string | null; message: string | null; amount: string | null; currency: string | null }[];
  reservations: {
    code: string;
    status: string;
    title: string;
    date: string;
    total: string;
    currency: string;
    services: { name: string; date: string; time: string | null; pax: number; status: string; confirmation: string | null }[];
    receivables: { code: string; kind: string; concept: string; amount: string; paid: string; currency: string; status: string; due_date: string }[];
    vouchers: { code: string; label: string; date: string; status: string }[];
  }[];
}

export function cartCookie(agencia: string): string {
  return `qhapaq_cart_${agencia}`;
}

export function orderCookie(code: string): string {
  return `qhapaq_order_${code}`;
}

export const SITE_COUNTRIES = ["Perú", "Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Ecuador", "México", "Estados Unidos", "Canadá", "España", "Francia", "Alemania", "Reino Unido", "Italia", "Otro"].map((value) => ({ value, label: value }));

export const SITE_DOC_TYPES = [{ value: "DNI", label: "DNI" }, { value: "CE", label: "Carné ext." }, { value: "Pasaporte", label: "Pasaporte" }];

export const WISHLIST_STORAGE_KEY = "qts_site_wishlist";

export function accountCookie(agencia: string): string {
  return `qhapaq_account_${agencia}`;
}

export interface AccountMoney {
  currency: string;
  amount: string;
}

export interface AccountMe {
  code: string;
  name: string;
  email: string | null;
  login_email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  document: string | null;
  birth_date: string | null;
  locale: string;
  verified: boolean;
  newsletter: boolean;
  passenger: boolean;
  arco_types: { value: string; label: string; days: number }[];
  arco_requests: { code: string; subject: string; status: string; due_date: string | null; created_at: string; resolution: string | null }[];
  portal_url: string;
}

export interface AccountReservation {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  total: string;
  currency: string;
  balance: AccountMoney[];
  vouchers: number;
  order: string | null;
}

export interface AccountReceivable {
  code: string;
  kind: string;
  concept: string;
  reservation: string;
  reservation_title: string;
  amount: string;
  paid: string;
  pending: string;
  payable: string;
  currency: string;
  due_date: string;
  status: string;
  can_pay: boolean;
}

export interface AccountVoucher {
  code: string;
  label: string;
  date: string;
  status: string;
  reservation: string;
}

export interface AccountReservationDetail {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  total: string;
  currency: string;
  order: string | null;
  services: { name: string; date: string; time: string | null; pax: number; status: string; confirmation: string | null }[];
  passengers: { name: string; type: string; pending: boolean; lead: boolean }[];
  receivables: AccountReceivable[];
  vouchers: AccountVoucher[];
  payments: { code: string; method: string; amount: string; currency: string; status: string; date: string }[];
}

export interface AccountReceivables {
  items: AccountReceivable[];
  totals: { payable: AccountMoney[]; pending: AccountMoney[] };
  methods: { value: string; label: string }[];
  bank_accounts: CheckoutTerms["bank_accounts"];
}
