export interface OperatorStaff {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  role: "guia" | "conductor";
}

export interface OperatorService {
  code: string;
  name: string;
  time: string | null;
  kind: string;
  status: string;
  pax: number;
  confirmation: string | null;
  reservation: string;
  reservation_title: string;
  lead: { name: string; phone: string | null } | null;
  assignment: string | null;
  confirmed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  guide: string | null;
  driver: string | null;
  vehicle: string | null;
}

export interface OperatorPreview {
  today: string;
  date: string;
  days: { date: string; services: number }[];
  staff: OperatorStaff[];
  selected_staff: OperatorStaff | null;
  devices: { active: number; last_sync_at: string | null };
  kpis: { services: number; pax: number; assigned: number; confirmed: number; done: number };
  services: OperatorService[];
}

export interface TripService {
  code: string;
  name: string;
  time: string | null;
  kind: string;
  status: string;
  confirmation: string | null;
  guide: string | null;
  driver: string | null;
  vehicle: string | null;
}

export interface PassengerTrip {
  code: string;
  title: string;
  client: string;
  status: string;
  from: string;
  to: string;
  day: number | null;
  days_total: number;
  next: { name: string; date: string; time: string | null } | null;
  passengers: { name: string; type: string; lead: boolean }[];
  itinerary: { date: string; day: number; services: TripService[] }[];
  chat: { from: string; sender: string | null; body: string; at: string }[];
  alerts: { code: string; type: string; severity: string; title: string; message: string | null; at: string }[];
  vouchers: { code: string; label: string; date: string; status: string; version: number }[];
}

export interface PassengerPreview {
  today: string;
  reservations: { code: string; title: string; client: string; status: string; from: string }[];
  trip: PassengerTrip | null;
}
