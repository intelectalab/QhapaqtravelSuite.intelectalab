import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/shell/NoAccess";
import { ReportView } from "@/features/reports/ReportView";
import { getReport } from "@/lib/server/reports";

const TITLES: Record<string, string> = { comercial: "Comercial", cotizaciones: "Cotizaciones", reservas: "Reservas", operaciones: "Operaciones", finanzas: "Finanzas", proveedores: "Proveedores", clientes: "Clientes" };

export async function generateMetadata({ params }: PageProps<"/reportes/[report]">): Promise<Metadata> {
  const { report } = await params;
  return { title: `Reporte ${TITLES[report] ?? ""}`.trim() };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reportes/[report]">) {
  const { report } = await params;
  if (!TITLES[report]) notFound();
  const { period, sede } = await searchParams;
  const data = await getReport(report, typeof period === "string" ? period : undefined, typeof sede === "string" ? sede : undefined);
  if (!data) return <NoAccess home="/reportes" />;
  return <ReportView report={data} />;
}
