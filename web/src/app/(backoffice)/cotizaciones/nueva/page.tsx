import { redirect } from "next/navigation";

export default async function NuevaCotizacionPage({ searchParams }: PageProps<"/cotizaciones/nueva">) {
  const { oportunidad } = await searchParams;
  redirect(`/cotizaciones?nueva=1${typeof oportunidad === "string" && oportunidad ? `&oportunidad=${encodeURIComponent(oportunidad)}` : ""}`);
}
