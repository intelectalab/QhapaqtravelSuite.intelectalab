import type { Metadata } from "next";
import { SupplierCalendarView } from "@/features/supplier-portal/SupplierCalendarView";
import type { SupplierCalendar } from "@/lib/supplier-portal";
import { supplierData } from "../data";

export const metadata: Metadata = { title: "Calendario" };

export default async function SupplierCalendarPage({ searchParams }: PageProps<"/proveedor/calendario">) {
  const { mes } = await searchParams;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : null;
  const data = await supplierData<SupplierCalendar>(`/calendar${month ? `?month=${month}` : ""}`, "No pudimos cargar el calendario.");
  return <SupplierCalendarView data={data} />;
}
