import { redirect } from "next/navigation";

export default function NuevoClientePage() {
  redirect("/crm/clientes?nuevo=1");
}
