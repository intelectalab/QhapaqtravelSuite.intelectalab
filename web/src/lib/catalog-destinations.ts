import type { Tone } from "./tone";

export interface DestinationNode {
  id: string;
  ref: string;
  name: string;
  type: string;
  level: number;
  depth: number;
  path: string;
  parent: { id: string; ref: string; name: string } | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  children: number;
  direct_products: number;
  products: { code: string; name: string; status: string }[];
}

export interface DestinationsOverview {
  destinations: DestinationNode[];
  options: { types: string[] };
  can: { manage: boolean };
}

export const DESTINATION_TONE: Record<string, Tone> = {
  País: "brand",
  Región: "t1",
  Departamento: "t4",
  Provincia: "info",
  Ciudad: "violet",
  Zona: "accent",
  Lugar: "t3",
  Atracción: "sun",
  Ruta: "ok",
};
