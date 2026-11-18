import { redirect } from "next/navigation";
import { TRIP_FIRST_SECTION } from "@/lib/portal";

export default function PassengerTripIndex() {
  redirect(TRIP_FIRST_SECTION);
}
