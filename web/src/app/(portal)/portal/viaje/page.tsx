import { redirect } from "next/navigation";
import { TRIP_SECTIONS } from "@/features/portal/PassengerServices";

export default function PassengerTripIndex() {
  redirect(TRIP_SECTIONS[0].href);
}
