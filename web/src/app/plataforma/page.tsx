import { redirect } from "next/navigation";
import { REALMS } from "@/lib/realms";

export default function PlatformIndex() {
  redirect(REALMS.platform.home);
}
