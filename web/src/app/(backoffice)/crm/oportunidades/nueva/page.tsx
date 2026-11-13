import { redirect } from "next/navigation";

export default function NuevaOportunidadPage() {
  redirect("/crm/oportunidades?nueva=1");
}
