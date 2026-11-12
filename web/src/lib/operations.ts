import type { SelectOption } from "@/components/ui/Select";
import type { ReservationWebSnapshot } from "@/lib/reservations";

export interface Person {
  id: string;
  name: string;
  color?: string | null;
}

export interface OrderRow {
  code: string;
  lock_version: number;
  title: string;
  status: string;
  date_from: string;
  date_to: string;
  created_at: string;
  reservation: { code: string; status: string; client: string };
  coordinator: Person;
  passengers: number;
  assignments: { total: number; pending: number; confirmed: number };
  tasks: { total: number; done: number };
  open_incidents: number;
  critical: boolean;
}

export interface OrderCandidate {
  code: string;
  title: string;
  status: string;
  travel_from: string;
  travel_to: string;
  client: string;
}

export interface OrderList {
  today: string;
  can: { assign: boolean; close: boolean };
  kpis: { running: number; pending_assignment: number; services_today: number; services_tomorrow: number; open_incidents: number; critical_incidents: number };
  items: OrderRow[];
  candidates: OrderCandidate[];
  coordinators: Person[];
  viewer_id: string;
}

export interface Assignment {
  id: string;
  lock_version: number;
  status: string;
  date: string;
  time: string | null;
  label: string;
  kind: string;
  service_code: string;
  service_status: string;
  order_code: string;
  order_status: string;
  order_title: string;
  reservation_code: string;
  passengers: number;
  checkin_at: string | null;
  confirmed_at: string | null;
  guide: { id: string; name: string } | null;
  driver: { id: string; name: string } | null;
  vehicle: { id: string; name: string; capacity: number } | null;
  checked_in?: string[];
}

export interface AssignmentPreview {
  blocks: string[];
  warnings: string[];
  ready: boolean;
  context: { passengers: number; languages: string[]; provider: string | null; recipients: number };
}

export interface ResourceOptions {
  guides: SelectOption[];
  drivers: SelectOption[];
  vehicles: SelectOption[];
}

export interface CloseCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  source: string;
  at: string;
  by: string | null;
  service?: { code: string; name: string } | null;
  incident?: string | null;
  incident_title?: string | null;
}

export interface EvidenceRules {
  max_bytes: number;
  mimes: string[];
}

export const EVIDENCE_RULES: EvidenceRules = { max_bytes: 10 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"] };

export const COMPLETABLE_SERVICE = ["confirmado", "en_curso"];

export interface OrderDetail {
  code: string;
  lock_version: number;
  title: string;
  status: string;
  date_from: string;
  date_to: string;
  created_at: string;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  today: string;
  reservation: { code: string; title: string; status: string; client: string; notes: string | null };
  coordinator: Person;
  tasks: { id: string; title: string; done: boolean; done_at: string | null; done_by: string | null }[];
  assignments: Assignment[];
  services: { id: string; code: string; lock_version: number; name: string; date: string; time: string | null; kind: string; status: string; confirmation: string | null; cost: string; currency: string; assigned: boolean; reject_reason: string | null; replaced: boolean; provider: { ref: string; name: string; active: boolean } | null; product: string | null; price?: string }[];
  passengers: { id: string; full_name: string; pax_type: string; nationality: string | null; diet_notes: string | null; is_lead: boolean; relationship: string | null; doc_type: string | null; doc_number: string | null; age: number | null; birth_date: string | null; phone: string | null; checkins: number; last_checkin_at: string | null }[];
  lodging_pending: { city: string; hotel: string; check_in: string; check_out: string; rooms: number }[];
  web: ReservationWebSnapshot | null;
  rooming: { id: string; city: string | null; hotel_name: string | null; hotel: string | null; check_in: string; check_out: string; status: string; sent_at: string | null; hotel_confirmed_at: string | null; rooms: number; guests: number }[];
  vouchers: { code: string; service_label: string; service_date: string; pax: number; status: string; version: number; provider: string | null; service_code: string | null }[];
  economics: { sale: string; cost: string; currency: string } | null;
  reject_reasons: string[];
  incidents: { code: string; title: string; type: string; severity: string; status: string; sla_due_at: string; created_at: string }[];
  evidences: number;
  evidence_files: EvidenceFile[];
  evidence_rules: EvidenceRules;
  checks: CloseCheck[];
  transitions: { status: string; label: string }[];
  can: { assign: boolean; close: boolean; incidents: boolean; services: boolean; vouchers: boolean; rooming: boolean };
  coordinators: Person[];
  options: ResourceOptions | null;
}

export interface CalendarDeparture {
  ref: string;
  product: { code: string; name: string };
  capacity: number;
  sold: number;
  guide: string | null;
  vehicle: string | null;
  meeting_point: string;
  return_point: string | null;
  notes: string | null;
}

export interface CalendarEvent {
  id: string;
  source: "service" | "departure";
  code: string;
  name: string;
  date: string;
  time: string | null;
  kind: string;
  status: string;
  confirmation: string | null;
  provider: { code: string; name: string } | null;
  reservation: { code: string; title: string; status: string } | null;
  client: { code: string; name: string } | null;
  passengers: number;
  order: { code: string; status: string } | null;
  assignment: Assignment | null;
  departure: CalendarDeparture | null;
  resources: string[];
  pending: boolean;
  pending_reason: string | null;
}

export interface CalendarMonth {
  today: string;
  month: string;
  previous: string;
  next: string;
  can: { assign: boolean; departures: boolean };
  kpis: { services: number; departures: number; pending: number; today: number };
  events: CalendarEvent[];
  options: ResourceOptions | null;
}

export interface AvailabilityItem {
  date: string;
  time: string | null;
  label: string;
  ref: string;
  source: "order" | "departure";
  done: boolean;
}

export interface AvailabilityCell {
  date: string;
  state: "libre" | "ocupado" | "descanso" | "vacaciones" | "mantenimiento" | "documento_vencido";
  document: "vencido" | "vence_hoy" | null;
  items: AvailabilityItem[];
}

export interface AvailabilityRow {
  id: string;
  kind: "guide" | "driver" | "vehicle";
  name: string;
  sub: string;
  status: string;
  busy: number;
  days: AvailabilityCell[];
}

export interface ResourceAvailability {
  today: string;
  from: string;
  previous: string;
  next: string;
  days: string[];
  groups: { kind: "guide" | "driver" | "vehicle"; label: string; rows: AvailabilityRow[] }[];
}

export interface SupplierAlternative {
  id: string;
  kind: string;
  review_status: string;
  review_note: string | null;
  responded_at: string;
  reviewed_at: string | null;
  responded_by: string | null;
  reviewed_by: string | null;
  note: string;
  hold_until: string | null;
  hold_expired: boolean;
  proposal: { date: string | null; service: { ref: string; name: string } | null; net_cost: number | null; currency: string };
  current: { date: string; name: string; net_cost: number; pax: number };
  service: { code: string; status: string; open: boolean };
  reservation: { code: string; title: string };
  order: string | null;
  provider: { ref: string; name: string };
}

export interface SupplierAlternativeList {
  today: string;
  can: { review: boolean };
  rows: SupplierAlternative[];
}

export interface LinkableUser extends SelectOption {
  resource_id: string | null;
  resource_name: string | null;
}

export interface LinkedUser {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface ResourceBase {
  id: string;
  status: string;
  upcoming: number;
  next: Assignment | null;
  provider: string | null;
}

export interface Guide extends ResourceBase {
  code: string;
  name: string;
  languages: string[];
  license: string;
  rating: number | null;
  phone: string | null;
  linked: boolean;
  user: LinkedUser | null;
}

export interface Driver extends ResourceBase {
  code: string;
  name: string;
  license: string;
  license_class: string | null;
  expires_on: string;
  document: DocumentState;
  phone: string | null;
  linked: boolean;
  user: LinkedUser | null;
}

export interface Vehicle extends ResourceBase {
  plate: string;
  type: string;
  capacity: number;
  soat_expires_on: string;
  document: DocumentState;
  provider_id: string | null;
}

export type DocumentState = "vigente" | "por_vencer" | "vencido" | "sin_dato";

export interface ResourceOverview {
  today: string;
  can: { assign: boolean };
  guides: Guide[];
  drivers: Driver[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  languages: SelectOption[];
  carriers: { id: string; name: string }[];
  options: ResourceOptions | null;
  users: { guide: LinkableUser[]; driver: LinkableUser[] } | null;
}

export interface RoomingRoom {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: string;
  note: string | null;
  guests: { id: string; name: string; infant: boolean }[];
}

export interface RoomingList {
  id: string;
  lock_version: number;
  reservation: { code: string; title: string; status: string };
  hotel: string;
  city: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  status: string;
  sent_at: string | null;
  sent_by: string | null;
  sent_version: number;
  hotel_ack_at: string | null;
  hotel_confirmed_at: string | null;
  rooms: RoomingRoom[];
  passengers: { id: string; name: string; infant: boolean }[];
  warnings: { level: "bad" | "warn" | "info"; text: string }[];
}

export interface RoomingOverview {
  today: string;
  can: { modify: boolean };
  room_types: SelectOption[];
  items: RoomingList[];
  candidates: (SelectOption & { from: string; to: string })[];
  hotels: SelectOption[];
  prefill: { reservation: string; title: string; legs: { city: string; hotel: string; rooms: number }[] }[];
}

export interface Voucher {
  code: string;
  lock_version: number;
  status: string;
  version: number;
  reservation: { code: string; title: string };
  service: { code: string; label: string; date: string; time: string | null; confirmation: string | null };
  provider: string;
  pax: number;
  note: string | null;
  issued_at: string;
  issued_by: string | null;
  used_at: string | null;
  used_via: string | null;
  void_reason: string | null;
  void_at: string | null;
  versions: { version: number; issued_at: string; issued_by: string | null; reason: string }[];
}

export interface PendingVoucher {
  code: string;
  name: string;
  date: string;
  time: string | null;
  status: string;
  kind: string;
  confirmation: string | null;
  reservation: { code: string; title: string };
  provider: { id: string; name: string } | null;
}

export interface VoucherOverview {
  today: string;
  can: { issue: boolean };
  kpis: { issued: number; used: number; voided: number; pending: number };
  items: Voucher[];
  pending: PendingVoucher[];
  providers: SelectOption[];
}

export interface IncidentRow {
  code: string;
  lock_version: number;
  title: string;
  type: string;
  severity: string;
  status: string;
  source: string;
  order: { code: string; title: string } | null;
  reservation: { code: string; title: string } | null;
  assignee: { name: string; color: string | null } | null;
  on_time?: boolean | null;
  reporter: string | null;
  created_at: string;
  sla_hours: number;
  sla_due_at: string;
  sla_pct: number;
  overdue: boolean;
  evidences?: number;
}

export interface IncidentList {
  now: string;
  can: { manage: boolean };
  kpis: { open: number; critical: number; in_process: number; overdue: number };
  items: IncidentRow[];
  types: string[];
  orders: SelectOption[];
  assignees: Person[];
}

export interface IncidentDetail extends IncidentRow {
  description: string;
  resolution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  assignee_id: string | null;
  logs: { id: string; user: string; kind: string; message: string; at: string }[];
  evidence_files: EvidenceFile[];
  can: { manage: boolean };
  types: string[];
  assignees: Person[];
}

export interface TravelDocRow {
  code: string;
  title: string;
  status: string;
  travel_from: string;
  travel_to: string;
  client: string;
  owner: string;
  passengers: number;
  documents: { total: number; complete: number; received: number; observed: number; pending: number };
  progress: number;
  expired: number;
  attention: number;
  last_reminder: string | null;
  days_to_travel: number;
  mapi: { services: { code: string; name: string; date: string; pax: number | null }[]; used: boolean; blocked: boolean; missing: { name: string; documents: string[] }[] } | null;
}

export interface TravelDocPassenger {
  id: string;
  name: string;
  pax_type: string;
  minor: boolean;
  nationality: string | null;
  is_lead: boolean;
  doc: string | null;
  identity: { status: string; expiry: string | null } | null;
  missing: { label: string; status: string }[];
  attention: boolean;
  status: string;
  reservation: string;
  reservation_title: string;
  travel_from: string;
}

export interface TravelDocList {
  today: string;
  can: { manage: boolean };
  kpis: { ready: number; to_review: number; observed: number; soon: number };
  items: TravelDocRow[];
  passengers: TravelDocPassenger[];
}

export interface TravelDocSettings {
  reminder_days: number[];
  channels: string[];
  passport_months: number;
  visa_nationalities: string[];
  insurance_trekking: boolean;
}

export interface TravelDocRules extends TravelDocSettings {
  job: { id: string; name: string; schedule: string | null; paused: boolean; last_run_at: string | null; next_run_at: string | null; last_status: string | null; last_result: string | null } | null;
  rules: { code: string; text: string }[];
}

export interface TravelDocument {
  id: string;
  type: string;
  kind: "file" | "contact" | "attention";
  label: string;
  status: string;
  lock_version: number;
  number: string | null;
  expiry: string | null;
  min_expiry: string | null;
  expires_before_return: boolean;
  file: string | null;
  has_file: boolean;
  observation: string | null;
  note: string | null;
  validated_by: string | null;
  validated_at: string | null;
}

export interface TravelDocDetailPassenger {
  id: string;
  name: string;
  pax_type: string;
  nationality: string | null;
  foreign: boolean;
  minor: boolean;
  is_lead: boolean;
  documents: TravelDocument[];
  not_applicable: string[];
  contact: { name: string; phone: string; relation: string } | null;
  attention: { flag: boolean; note: string | null } | null;
}

export interface TravelDocDetail {
  code: string;
  title: string;
  status: string;
  travel_from: string;
  travel_to: string;
  client: string;
  owner: string;
  today: string;
  can: { manage: boolean; request: boolean };
  settings: TravelDocSettings;
  relations: string[];
  request: { email: string | null; phone: string | null; channels: string[]; pending: number };
  mapi: { services: { code: string; name: string; date: string; pax: number | null }[]; used: boolean; blocked: boolean; missing: { name: string; documents: string[] }[] } | null;
  passengers: TravelDocDetailPassenger[];
  reminders: { at: string; channel: string; to: string; trigger: string; days_before: number | null; items: number; by: string | null }[];
}

export const SEVERITY_LABEL: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta", critica: "Crítica" };

export const SEVERITY_HOURS: Record<string, number> = { critica: 4, alta: 8, media: 24, baja: 72 };

export const SOURCE_LABEL: Record<string, string> = { web: "Web", app_operador: "App del operador", extranet: "Extranet", sistema: "Sistema" };

export const LOG_LABEL: Record<string, string> = { registro: "Registro", comentario: "Comentario", estado: "Estado", asignacion: "Asignación", reclasificacion: "Reclasificación", alerta: "Alerta", evidencia: "Evidencia", resolucion: "Resolución" };

export const DOCUMENT_STATE: Record<DocumentState, { label: string; tone: "ok" | "warn" | "bad" | "mute" }> = {
  vigente: { label: "Vigente", tone: "ok" },
  por_vencer: { label: "Vence pronto", tone: "warn" },
  vencido: { label: "Vencido", tone: "bad" },
  sin_dato: { label: "Sin dato", tone: "mute" },
};

export const PERSON_STATUS = ["disponible", "asignado", "descanso", "vacaciones"];

export const VEHICLE_STATUS = ["disponible", "asignado", "mantenimiento"];

export const LICENSE_CLASSES = ["A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc"];

export const ROOM_STATUS = ["pendiente", "confirmada", "observada"];

export const ORDER_FLOW = ["planificada", "pendiente_asignacion", "asignada", "confirmada", "en_ejecucion", "completada"];

export const OPEN_INCIDENT = ["abierta", "en_proceso"];
