import { statusLabel, statusTone, type Tone } from "@/lib/tone";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  publicada: { label: "Publicada", tone: "ok" },
  oculta: { label: "Oculta", tone: "mute" },
  sin_responder: { label: "Sin responder", tone: "warn" },
  pendiente_publicar: { label: "Respuesta por publicar", tone: "info" },
  no_admite: { label: "No admite respuesta", tone: "mute" },
  programada: { label: "Programada", tone: "info" },
  respondida: { label: "Respondida", tone: "ok" },
  programado: { label: "Programado", tone: "info" },
  entregado: { label: "Entregado", tone: "accent" },
  leido: { label: "Leído", tone: "ok" },
  respondido: { label: "Respondido", tone: "ok" },
  derivado: { label: "Derivado", tone: "violet" },
  conectado: { label: "Conectado", tone: "ok" },
  no_conectado: { label: "Sin conectar", tone: "mute" },
  verificado: { label: "Verificado", tone: "ok" },
  expirado: { label: "Expirado", tone: "mute" },
  pago_por_validar: { label: "Pago por validar", tone: "info" },
  aprobado: { label: "Aprobado", tone: "info" },
  vencida: { label: "Vencida", tone: "bad" },
};

export function channelStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: statusLabel(status), tone: statusTone(status) };
}

export type Money = Record<string, number>;

export interface B2bAgency {
  id: string;
  code: string;
  legal_name: string;
  ruc: string;
  contact_name: string;
  booking_email: string | null;
  client: { code: string; name: string } | null;
  price_list: { id: string; name: string };
  commission_pct: number;
  currency: string;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  usage_pct: number | null;
  valid_from: string;
  valid_to: string;
  status: "activa" | "bloqueada" | "inactiva";
  effective_status: string;
  block_reason: string | null;
  lock_version: number;
  sales: number;
  commission: number;
  reservations: { code: string; title: string; status: string; travel_from: string; total: number; currency: string }[];
}

export interface B2bOverview {
  today: string;
  kpis: { active: number; total: number; restricted: number; credit_limit: number; credit_used: number; sales: number; commission: number; currency: string };
  items: B2bAgency[];
  price_lists: { id: string; name: string }[];
  clients: { code: string; name: string }[];
  can_manage: boolean;
}

export interface EcomOrder {
  code: string;
  ordered_at: string;
  customer: string;
  email: string;
  country: string | null;
  product: { code: string; name: string } | null;
  pax: number;
  total: number;
  currency: string;
  status: string;
  promo_code: string | null;
  reservation: string | null;
  cancel_reason: string | null;
  can_cancel: boolean;
  lock_version: number;
}

export interface EcomProduct {
  code: string;
  name: string;
  status: string;
  featured: boolean;
  rating: number | null;
  rating_count: number;
  published: boolean;
  published_at: string | null;
  orders: number;
  sales: Money;
}

export interface EcommerceOverview {
  kpis: { orders: number; confirmed: number; pending: number; rejected: number; conversion: number; revenue: Money; published: number };
  funnel: { id: string; label: string; value: number }[];
  orders: EcomOrder[];
  products: EcomProduct[];
  can_manage: boolean;
}

export interface CmsLogEntry {
  at: string;
  user: string;
  message: string;
  reason: string | null;
  to: string | null;
}

export interface CmsContent {
  code: string;
  title: string;
  type: string;
  channel: string;
  slug: string;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  placement: string | null;
  valid_from: string | null;
  valid_to: string | null;
  published_at: string | null;
  updated_at: string;
  author: string;
  lock_version: number;
  next: string[];
  log: CmsLogEntry[];
}

export interface CmsOverview {
  kpis: Record<string, number>;
  items: CmsContent[];
  types: string[];
  channels: string[];
  can_publish: boolean;
}

export const CMS_FLOW = ["borrador", "en_revision", "aprobado", "publicado", "despublicado"];

export const CMS_ACTIONS: Record<string, { label: string; reason: boolean; hint: string }> = {
  en_revision: { label: "Enviar a revisión", reason: false, hint: "Queda a la espera de un editor." },
  aprobado: { label: "Aprobar", reason: false, hint: "Listo para publicarse." },
  borrador: { label: "Devolver a borrador", reason: true, hint: "El autor verá el motivo en la bitácora." },
  publicado: { label: "Publicar", reason: false, hint: "Se muestra de inmediato en su canal." },
  despublicado: { label: "Despublicar", reason: true, hint: "Deja de mostrarse; se conserva para volver a publicarlo." },
};

export interface WebDomain {
  id: string;
  domain: string;
  cms: string | null;
  status: string;
  token: string;
  verified_at: string | null;
  added_at: string;
  added_by: string | null;
}

export interface WebEvent {
  id: number;
  at: string;
  session: string;
  event: string;
  params: Record<string, string>;
  locale: string;
  currency: string;
  client: string | null;
}

export interface WidgetDefaults {
  product: string | null;
  product_name: string | null;
  mode: string;
  category: string | null;
  lang: string;
  currency: string;
  theme: string;
  radius: number;
  reviews: boolean;
  method: string;
  domain: string | null;
}

export interface WebOverview {
  config: { tenant_slug: string; public_key: string; key_created_at: string; key_created_by: string | null; cdn: string | null; host: string | null } | null;
  defaults: WidgetDefaults;
  domains: WebDomain[];
  events: WebEvent[];
  kpis: { domains: number; verified: number; events: number; sessions: number; handoffs: number };
  products: { code: string; name: string }[];
  methods: { value: string; label: string }[];
  can_manage: boolean;
}

export interface OwnReview {
  code: string;
  author: string;
  author_name: string;
  country: string | null;
  client: string;
  reservation: string;
  product: { code: string; name: string };
  travel_date: string;
  stars: number;
  subratings: { key: string; label: string; value: number }[];
  title: string;
  body: string;
  lang: string;
  status: string;
  moderation_reason: string | null;
  reply: string | null;
  replied_at: string | null;
  reply_by: string | null;
  source: string;
  verified: boolean;
  consent: boolean;
  is_demo: boolean;
  helpful: number;
  photos: number;
  published_at: string | null;
  created_at: string;
  lock_version: number;
  log: { action: string; note: string | null; at: string; user: string }[];
}

export interface ReviewRequest {
  code: string;
  reservation: string;
  client: string;
  to: string;
  channel: string;
  lang: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  expires_at: string | null;
  reviews: number;
}

export interface OwnReviewsOverview {
  kpis: { average: number | null; published: number; received: number; recommend_pct: number | null; pending: number; flagged: number };
  distribution: { stars: number; count: number }[];
  by_product: { code: string; name: string; average: number; count: number }[];
  subratings: { key: string; label: string; average: number | null; count: number }[];
  items: OwnReview[];
  requests: ReviewRequest[];
  own_only: boolean;
  can_moderate: boolean;
}

export interface ReviewSource {
  provider: string;
  label: string;
  status: string;
  rating: number | null;
  count: number;
  account: string | null;
  key_last4: string | null;
  can_reply: boolean;
  invites: boolean;
  last_sync_at: string | null;
  connected_at: string | null;
  connected_by: string | null;
  inbox: number;
}

export interface ExternalReview {
  id: string;
  code: string;
  provider: string;
  source: string;
  can_reply: boolean;
  author: string;
  date: string;
  rating: number;
  title: string | null;
  body: string | null;
  lang: string | null;
  product: { code: string; name: string } | null;
  url: string | null;
  status: string;
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
}

export interface ExternalReviewsOverview {
  kpis: { average: number | null; total: number; connected: number; inbox: number; unanswered: number; critical: number };
  sources: ReviewSource[];
  items: ExternalReview[];
  can_reply: boolean;
}

export interface CustomerPortal {
  code: string;
  name: string;
  email: string | null;
  country: string | null;
  advisor: { name: string; email: string; phone: string | null } | null;
  kpis: { next_trip: { code: string; title: string; from: string } | null; awaiting_quotes: number; balance: Money; documents: number };
  reservations: { code: string; title: string; status: string; from: string; to: string; total: number; currency: string; services: number; confirmed: number; passengers: number }[];
  quotes: { code: string; title: string; status: string; valid_until: string | null; travel_from: string | null; version: number; total: number | null; currency: string; expired: boolean }[];
  payments: { code: string; concept: string; kind: string; reservation: string; amount: number; paid: number; balance: number; currency: string; due_date: string; status: string }[];
  documents: { code: string; label: string; date: string; status: string; version: number; reservation: string }[];
  wishlist: { code: string; name: string }[];
}

export interface CustomerPortalPreview {
  today: string;
  clients: { code: string; name: string }[];
  client: CustomerPortal | null;
}

export interface PaxMessage {
  code: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  status: string;
  direction: string;
  origin: string;
  template: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  read_at: string | null;
  attempts: number;
  error: string | null;
  lang: string;
  reservation: string | null;
  reservation_title: string | null;
}

export interface PaxFeedback {
  code: string;
  passenger: string;
  type: string;
  rating: number | null;
  text: string;
  status: string;
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  channel: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  reservation: string;
  reservation_title: string;
  service: string | null;
}

export interface PassengerPortalOverview {
  kpis: { sent: number; read: number; read_pct: number | null; scheduled: number; failed: number; feedback_new: number; feedback_total: number; rating: number | null };
  messages: PaxMessage[];
  feedback: PaxFeedback[];
  can_reply: boolean;
}

export const FEEDBACK_TYPES: Record<string, string> = {
  comentario: "Comentario",
  sugerencia: "Sugerencia",
  felicitacion: "Felicitación",
  reclamo: "Reclamo",
  incidencia: "Incidencia",
};

export const MESSAGE_CHANNELS: Record<string, string> = { email: "Correo", whatsapp: "WhatsApp", portal: "Portal", push: "Notificación push" };

export const SERVICE_KINDS: Record<string, string> = { tour: "Tour", traslado: "Traslado", tren_entrada: "Tren o entrada", alojamiento: "Alojamiento", libre: "Día libre" };
