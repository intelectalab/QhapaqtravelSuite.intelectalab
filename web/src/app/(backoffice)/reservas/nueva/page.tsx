import { redirect } from "next/navigation";

export default function NuevaReservaPage() {
  redirect("/reservas?nueva=1");
}
