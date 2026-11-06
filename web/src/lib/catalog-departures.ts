import type { Tone } from "./tone";

export type DepartureStatus = "abierta" | "completa" | "cerrada" | "cancelada";

export interface DepartureRow {
  ref: string;
  product: { id: string; code: string; name: string; status: string };
  date: string;
  time: string;
  capacity: number;
  sold: number;
  held: number;
  available: number;
  status: DepartureStatus;
  future: boolean;
  meeting_point: string;
  return_point: string | null;
  notes: string | null;
  provider: { id: string | null; name: string | null };
  guide: { id: string; name: string } | null;
  vehicle: { id: string; plate: string; capacity: number } | null;
  lock_version: number;
}

export interface DeparturesOverview {
  today: string;
  departures: DepartureRow[];
  options: {
    products: { id: string; code: string; name: string; status: string; maximum_passengers: number }[];
    providers: { id: string; name: string; type: string }[];
    guides: { id: string; name: string }[];
    vehicles: { id: string; plate: string; vehicle_type: string; capacity: number }[];
  };
  can: { manage: boolean };
}

export const DEPARTURE_STATUS: Record<DepartureStatus, { label: string; tone: Tone }> = {
  abierta: { label: "Abierta", tone: "ok" },
  completa: { label: "Completa", tone: "sun" },
  cerrada: { label: "Cerrada", tone: "mute" },
  cancelada: { label: "Cancelada", tone: "bad" },
};
