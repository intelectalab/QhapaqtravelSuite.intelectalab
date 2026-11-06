import type { Metadata } from "next";
import { AgencyProductView } from "@/features/b2b-portal/AgencyProduct";
import type { AgencyProduct } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Cotizar y reservar" };

export default async function AgencyProductPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ mes?: string; pax?: string; fecha?: string }> }) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const pax = Math.max(1, Math.min(60, Number(query.pax) || 2));
  const month = query.mes && /^\d{4}-\d{2}$/.test(query.mes) ? query.mes : "";
  const data = await agencyData<AgencyProduct>(`/catalog/${encodeURIComponent(code)}?pax=${pax}${month ? `&month=${month}` : ""}`, "No pudimos cargar el producto.");
  if (!data) return null;
  return <AgencyProductView data={data} initialDate={query.fecha ?? null} />;
}
