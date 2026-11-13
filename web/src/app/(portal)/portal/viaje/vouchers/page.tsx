import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerVouchersView } from "@/features/portal/PassengerServices";
import type { PaxVouchers } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Vouchers" };

export default async function PassengerVouchersPage() {
  const data = await passengerData<PaxVouchers>("/vouchers", "No pudimos cargar tus vouchers.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerVouchersView data={data} />;
}
