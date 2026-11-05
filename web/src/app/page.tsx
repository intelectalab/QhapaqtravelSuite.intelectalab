import { redirect } from "next/navigation";
import { HOME_HREF } from "@/config/navigation";

export default function Home() {
  redirect(HOME_HREF);
}
