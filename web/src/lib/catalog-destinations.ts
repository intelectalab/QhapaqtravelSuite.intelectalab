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
  products: { code: string; name: string; status: string; relation: "principal" | "secundario" | "subdestino"; price_from: { amount: string; currency: string } | null }[];
}

export interface DestinationsOverview {
  destinations: DestinationNode[];
  options: { types: string[] };
  can: { manage: boolean };
}

export const DESTINATION_RANK: Record<string, number> = { País: 0, Región: 1, Departamento: 2, Provincia: 3, Ciudad: 4, Zona: 4, Lugar: 5, Atracción: 6, Ruta: 6 };

export function allowedDestinationTypes(types: string[], parentType: string | null | undefined): string[] {
  if (parentType === null) return types.filter((type) => type === "País");
  if (parentType === undefined || DESTINATION_RANK[parentType] === undefined) return types;
  return types.filter((type) => (DESTINATION_RANK[type] ?? -1) > DESTINATION_RANK[parentType]);
}

export function outsidePeru(lat: number, lng: number): boolean {
  return lat < -18.4 || lat > 0 || lng < -81.4 || lng > -68.6;
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
