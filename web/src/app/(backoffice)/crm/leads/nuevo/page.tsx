import { redirect } from "next/navigation";

export default function NuevoLeadPage() {
  redirect("/crm/leads?nuevo=1");
}
