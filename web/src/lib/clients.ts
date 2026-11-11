export type ClientKind = "Persona" | "Empresa";

export interface ClientRow {
  id: string;
  kind: ClientKind;
  name: string;
  document: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  segment: string;
  ownerName: string;
  ownerColor: string | null;
  satisfaction: number | null;
  trips: number;
  totalPen: number;
  lastTripFrom: string | null;
  upcomingTrip: boolean;
  onTrip: boolean;
  createdAt: string;
}

export interface ClientTrip {
  id: string;
  title: string;
  status: string;
  from: string;
  to: string;
  totalPen: number;
  passengers: string[];
}

export interface ClientQuote {
  id: string;
  title: string;
  status: string;
  validUntil: string;
}

export interface TripDay {
  date: string;
  state: "done" | "today" | "risk" | "upcoming";
}

export type PortalAccessStatus = "sin_acceso" | "invitado" | "activo" | "revocado";

export interface PortalAccess {
  status: PortalAccessStatus;
  email: string | null;
  invitedAt: string | null;
  invitationExpiresAt: string | null;
  invitationExpired: boolean;
  lastLoginAt: string | null;
  revokedAt: string | null;
}

export interface ApiPortalAccess {
  status: PortalAccessStatus;
  email: string | null;
  user: string | null;
  invited_at: string | null;
  invitation_expires_at: string | null;
  invitation_expired: boolean;
  last_login_at: string | null;
  revoked_at: string | null;
}

export const NO_PORTAL_ACCESS: PortalAccess = { status: "sin_acceso", email: null, invitedAt: null, invitationExpiresAt: null, invitationExpired: false, lastLoginAt: null, revokedAt: null };

export function toPortalAccess(access: ApiPortalAccess | null | undefined): PortalAccess {
  if (!access) return NO_PORTAL_ACCESS;
  return {
    status: access.status,
    email: access.email,
    invitedAt: access.invited_at,
    invitationExpiresAt: access.invitation_expires_at,
    invitationExpired: access.invitation_expired,
    lastLoginAt: access.last_login_at,
    revokedAt: access.revoked_at,
  };
}

export interface ClientDetail extends ClientRow {
  portalAccess: PortalAccess;
  tags: string[];
  birth: string | null;
  rawKind: "persona" | "empresa";
  docType: string;
  docNumber: string;
  ownerId: string;
  rawSegment: string;
  history: ClientTrip[];
  quotes: ClientQuote[];
  balancePen: number;
  overduePen: number;
  companions: { name: string; document: string; diet: string }[];
  currentTrip: { trip: ClientTrip; days: TripDay[]; dayNumber: number; incident: { id: string; title: string } | null } | null;
  arcoRequests: { code: string; subject: string; dueDate: string | null }[];
  contacts: ClientContact[];
  sourceLead: { code: string; full_name: string; source_code: string | null } | null;
  openOpportunities: { code: string; title: string; stage: string; amount: string | null; currency: string; expected_close_date: string | null }[];
  nextActivities: { code: string; type: string; subject: string; status: string; due_at: string | null; owner: string | null }[];
  satisfactionDetail: { last: number; average: number; count: number; comment: string | null } | null;
  destinations: string[];
  openCases: { code: string; subject: string; priority: string | null; status: string }[];
  cancelledTrips: number;
}

export interface ClientContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export const CLIENT_TABS = ["leads", "opportunities", "quotes", "reservations", "passengers", "receivables", "payments", "invoices", "vouchers", "communications", "activities", "timeline", "audit"] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

export interface ClientTabData {
  leads: { code: string; full_name: string; source_code: string | null; interest_code: string | null; destination_label: string | null; score: number | null; status: string; created_at: string }[];
  opportunities: { code: string; title: string; stage: string; amount: string | null; currency: string; probability: number | null; expected_close_date: string | null; closed_at: string | null; owner: string | null }[];
  quotes: { code: string; title: string; status: string; version: number; valid_until: string; currency: string; total: string | null; created_at: string }[];
  reservations: { code: string; title: string; status: string; channel: string; travel_from: string; travel_to: string; total: string; currency: string; pax: number; paid: string }[];
  passengers: { name: string; document: string | null; pax_type: string; nationality: string | null; birth_date: string | null; notes: string | null; relationship: string | null; reservations: string[] }[];
  receivables: { code: string; concept: string; amount: string; paid_amount: string; currency: string; due_date: string; status: string; reservation: string }[];
  payments: { code: string; paid_on: string; method: string; reference: string | null; amount: string; currency: string; status: string; reservation: string }[];
  invoices: { number: string; doc_type: string; issue_date: string; total_amount: string; currency: string; status: string; reservation: string | null }[];
  vouchers: { code: string; service_label: string; service_date: string; pax: number; status: string; version: number; provider: string | null; reservation: string }[];
  communications: { code: string; event_code: string | null; channel: string; recipient_address: string | null; subject: string | null; status: string; last_error: string | null; sent_at: string | null; created_at: string }[];
  activities: { code: string; type: string; subject: string; status: string; due_at: string | null; completed_at: string | null; related_type: string; owner: string | null }[];
  timeline: { kind: string; at: string; title: string; code: string; href: string | null }[];
  audit: { id: string; entity: string; entity_id: string; action: string; before: string | null; after: string | null; actor_type: string; occurred_at: string; actor: string | null }[];
}

export interface ApiClient {
  code: string;
  kind: "persona" | "empresa";
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
  segment: string;
  owner: { name: string; color: string | null };
  satisfaction: number | null;
  trips_count: number;
  total_pen: number;
  last_trip_from: string | null;
  on_trip: boolean;
  created_at: string;
}

interface ApiTrip {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  total_pen: number;
  passengers: string[];
}

export interface ApiClientDetail extends ApiClient {
  tags: string[];
  birth_date: string | null;
  doc_type: string;
  doc_number: string;
  owner_id: string;
  trips: ApiTrip[];
  quotes: { code: string; title: string; status: string; valid_until: string }[];
  balance_pen: number;
  overdue_pen: number;
  companions: { name: string; document: string; diet: string }[];
  current_trip: { trip: ApiTrip; days: TripDay[]; day_number: number; incident: { code: string; title: string } | null } | null;
  portal_access?: ApiPortalAccess | null;
  arco_requests?: { code: string; subject: string; due_date: string | null }[];
  contacts?: ClientContact[];
  source_lead?: ClientDetail["sourceLead"];
  open_opportunities?: ClientDetail["openOpportunities"];
  next_activities?: ClientDetail["nextActivities"];
  satisfaction_detail?: ClientDetail["satisfactionDetail"];
  destinations?: string[];
  open_cases?: ClientDetail["openCases"];
  cancelled_trips?: number;
}

const SEGMENT_LABEL: Record<string, string> = {
  Retail: "Particular",
  Corporativo: "Corporativo",
  VIP: "VIP",
  Grupos: "Grupos",
  B2B: "Agencia aliada",
};

export function segmentLabel(code: string): string {
  return SEGMENT_LABEL[code] ?? code;
}

function toTrip(trip: ApiTrip): ClientTrip {
  return { id: trip.code, title: trip.title, status: trip.status, from: trip.from, to: trip.to, totalPen: trip.total_pen, passengers: trip.passengers };
}

export function toClientRow(client: ApiClient, today: string): ClientRow {
  return {
    id: client.code,
    kind: client.kind === "empresa" ? "Empresa" : "Persona",
    name: client.name,
    document: client.document,
    email: client.email ?? "",
    phone: client.phone ?? "",
    city: client.city ?? "",
    country: client.country,
    segment: segmentLabel(client.segment),
    ownerName: client.owner.name,
    ownerColor: client.owner.color,
    satisfaction: client.satisfaction,
    trips: client.trips_count,
    totalPen: client.total_pen,
    lastTripFrom: client.last_trip_from,
    upcomingTrip: client.last_trip_from !== null && client.last_trip_from > today,
    onTrip: client.on_trip,
    createdAt: client.created_at,
  };
}

export function toClientDetail(client: ApiClientDetail, today: string): ClientDetail {
  const current = client.current_trip;
  return {
    ...toClientRow(client, today),
    tags: client.tags,
    birth: client.birth_date,
    rawKind: client.kind,
    docType: client.doc_type,
    docNumber: client.doc_number,
    ownerId: client.owner_id,
    rawSegment: client.segment,
    history: client.trips.map(toTrip),
    quotes: client.quotes.map((quote) => ({ id: quote.code, title: quote.title, status: quote.status, validUntil: quote.valid_until })),
    balancePen: client.balance_pen,
    overduePen: client.overdue_pen,
    companions: client.companions,
    portalAccess: toPortalAccess(client.portal_access),
    arcoRequests: (client.arco_requests ?? []).map((request) => ({ code: request.code, subject: request.subject, dueDate: request.due_date })),
    contacts: client.contacts ?? [],
    sourceLead: client.source_lead ?? null,
    openOpportunities: client.open_opportunities ?? [],
    nextActivities: client.next_activities ?? [],
    satisfactionDetail: client.satisfaction_detail ?? null,
    destinations: client.destinations ?? [],
    openCases: client.open_cases ?? [],
    cancelledTrips: client.cancelled_trips ?? 0,
    currentTrip: current
      ? { trip: toTrip(current.trip), days: current.days, dayNumber: current.day_number, incident: current.incident ? { id: current.incident.code, title: current.incident.title } : null }
      : null,
  };
}

export interface ClientFormOptions {
  segments: string[];
  advisors: { id: string; name: string; color: string | null }[];
  canReassign: boolean;
  canManage: boolean;
}

export const DOC_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "RUC", label: "RUC" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "CE", label: "Carné de extranjería" },
];
