import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerVoucherView } from "@/features/portal/PassengerServices";
import type { PaxVoucher } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Voucher" };

export default async function PassengerVoucherPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const voucher = await passengerData<PaxVoucher>(`/vouchers/${encodeURIComponent(code)}`, "No pudimos abrir el voucher.");
  if (!voucher) redirect(PORTAL_HOME);
  return <PassengerVoucherView voucher={voucher} />;
}
