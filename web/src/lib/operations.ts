import type { SelectOption } from "@/components/ui/Select";

export interface Person {
  id: string;
  name: string;
  color?: string | null;
}

export interface OrderRow {
  code: string;
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

export interface OrderDetail {
  code: string;
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
  services: { code: string; name: string; date: string; time: string | null; kind: string; status: string; confirmation: string | null; cost: string; currency: string; assigned: boolean }[];
  passengers: { id: string; full_name: string; pax_type: string; nationality: string | null; diet_notes: string | null; is_lead: boolean }[];
  incidents: { code: string; title: string; type: string; severity: string; status: string; sla_due_at: string; created_at: string }[];
  evidences: number;
  checks: CloseCheck[];
  transitions: { status: string; label: string }[];
  can: { assign: boolean; close: boolean; incidents: boolean };
  coordinators: Person[];
  options: ResourceOptions | null;
}

export interface CalendarEvent {
  code: string;
  name: string;
  date: string;
  time: string | null;
  kind: string;
  status: string;
  confirmation: string | null;
  provider: string | null;
  reservation: { code: string; title: string; status: string };
  order: { code: string; status: string } | null;
  assignment: string | null;
  resources: string[];
  pending: boolean;
  pending_reason: string | null;
}

export interface CalendarMonth {
  today: string;
  month: string;
  previous: string;
  next: string;
  can: { assign: boolean };
  kpis: { services: number; pending: number; reservations: number; busy_days: number };
  events: CalendarEvent[];
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
}

export interface Voucher {
  code: string;
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
  title: string;
  type: string;
  severity: string;
  status: string;
  source: string;
  order: { code: string; title: string } | null;
  reservation: { code: string; title: string } | null;
  assignee: { name: string; color: string | null } | null;
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
  evidence_files: { id: string; name: string; mime: string; size: number; source: string; at: string; by: string | null }[];
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
}

export interface TravelDocList {
  today: string;
  can: { manage: boolean };
  kpis: { ready: number; to_review: number; observed: number; soon: number };
  items: TravelDocRow[];
}

export interface TravelDocument {
  id: string;
  type: string;
  label: string;
  status: string;
  number: string | null;
  expiry: string | null;
  expires_before_return: boolean;
  file: string | null;
  observation: string | null;
  note: string | null;
  validated_by: string | null;
  validated_at: string | null;
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
  can: { manage: boolean };
  passengers: { id: string; name: string; pax_type: string; nationality: string | null; is_lead: boolean; documents: TravelDocument[]; contact: { name: string; phone: string; relation: string } | null; attention: { flag: boolean; note: string | null } | null }[];
  reminders: { at: string; channel: string; to: string; trigger: string; days_before: number | null; by: string | null }[];
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
