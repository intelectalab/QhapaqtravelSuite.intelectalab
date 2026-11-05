import { BedDouble, Bus, Car, Coffee, Map as MapIcon, TrainFront, type LucideIcon } from "lucide-react";

export interface ReservationRow {
  code: string;
  title: string;
  status: string;
  channel: string;
  travel_from: string;
  travel_to: string;
  total: string;
  currency: string;
  total_pen: number;
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  passengers: number;
  balance_pen: number;
  open_incidents: number;
}

export interface ReservationList {
  today: string;
  items: ReservationRow[];
}

export interface ReservationDetail extends Omit<ReservationRow, "passengers" | "balance_pen" | "open_incidents"> {
  today: string;
  notes: string | null;
  sede: string | null;
  quote: { code: string; title: string } | null;
  cancel_reason: string | null;
  margin_pct: number | null;
  passengers: { full_name: string; doc_type: string | null; doc_number: string | null; pax_type: string; nationality: string | null; age: number | null; diet_notes: string | null; relationship: string | null; is_lead: boolean }[];
  services: { code: string; name: string; date: string; time: string | null; kind: string; status: string; confirmation: string | null; price: string; cost: string | null; currency: string }[];
  receivables: { code: string; concept: string; amount: string; paid_amount: string; currency: string; due_date: string; status: string }[];
  incidents: { code: string; title: string; type: string; severity: string; status: string; created_at: string }[];
}

export const SERVICE_KIND: Record<string, { label: string; icon: LucideIcon }> = {
  tour: { label: "Tour", icon: MapIcon },
  traslado: { label: "Traslado", icon: Car },
  alojamiento: { label: "Alojamiento", icon: BedDouble },
  tren_entrada: { label: "Tren o entrada", icon: TrainFront },
  libre: { label: "Libre", icon: Coffee },
  transporte: { label: "Transporte", icon: Bus },
};

export const PAX_TYPE: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };
