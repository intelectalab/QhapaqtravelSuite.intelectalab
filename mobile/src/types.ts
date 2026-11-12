export type AssignmentStatus = "pendiente" | "asignada" | "confirmada" | "en_curso" | "completada" | "cancelada";

export interface Contact {
  role?: string;
  name: string;
  phone: string | null;
}

export interface Passenger {
  id: string;
  name: string;
  type: string;
  doc: string | null;
  diet: string | null;
  lead: boolean;
  phone: string | null;
  checked_at: string | null;
  no_show: boolean;
}

export interface Pickup {
  flight: string | null;
  arrival: string | null;
  sign: string | null;
  comments: string | null;
  tags: string[];
  diets: { name: string; diet: string }[];
}

export interface Evidence {
  id: string;
  name: string;
  mime: string;
  sha256: string;
  pending?: boolean;
}

export interface Assignment {
  id: string;
  status: AssignmentStatus;
  lock_version: number;
  date: string;
  time: string | null;
  label: string;
  kind: string | null;
  service: { code: string; name: string; status: string };
  order: { code: string; title: string; status: string };
  reservation: string | null;
  notes: string | null;
  vehicle: string | null;
  meeting_point: { text: string; source: "salida" | "cliente" | "producto" } | null;
  pickup?: Pickup;
  partner: Contact | null;
  coordinator: Contact | null;
  confirmed_at: string | null;
  started_at: string | null;
  first_checkin_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  passengers: Passenger[];
  checked_in: number;
  evidences: Evidence[];
  can: { confirm: boolean; start: boolean; checkin: boolean; evidence: boolean; finish: boolean };
}

export interface OperatorMe {
  type: "guide" | "driver";
  role: string;
  id: string;
  code: string;
  name: string;
  phone: string | null;
  status: string;
  license: string | null;
  license_class: string | null;
  license_expires_on: string | null;
  license_state: string | null;
  languages: string[];
  user: { name: string; email: string };
  today: string;
  sync_minutes?: number;
}

export interface Incident {
  code: string;
  type: string;
  severity: "baja" | "media" | "alta" | "critica";
  title: string;
  status: string;
  source: string;
  created_at: string;
  sla_due_at: string | null;
  order: string | null;
  related: boolean;
}

export interface Bootstrap {
  cursor: string;
  window: { from: string; to: string };
  me: OperatorMe;
  assignments: Assignment[];
  tombstones: string[];
  incidents: Incident[];
}

export interface ApiError {
  status: number;
  error?: string;
  code?: string;
  message: string;
  errors?: Record<string, string[]>;
}
