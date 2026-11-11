import type { Metadata } from "next";
import { AllotmentGridView } from "@/features/catalog-allotments/AllotmentBoard";
import type { AllotmentGrid } from "@/lib/catalog-allotments";
import { getAllotments } from "@/lib/server/allotments";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cupos por fecha" };

const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function CuposGridPage({ searchParams }: PageProps<"/catalogo/cupos">) {
  const overview = await getAllotments();
  if (!overview) return null;
  const params = await searchParams;
  const query = new URLSearchParams({ days: "14" });
  const from = pick(params.from);
  const kind = pick(params.kind);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query.set("from", from);
  if (kind && ["hotel", "tren", "entrada"].includes(kind)) query.set("kind", kind);
  if (pick(params.all) === "1") query.set("all", "1");
  const grid = await getResource<AllotmentGrid>(`/catalog/allotments/grid?${query.toString()}`, "No pudimos cargar la grilla de cupos.");
  if (!grid) return null;
  return <AllotmentGridView grid={grid} canManage={overview.can.manage} />;
}
