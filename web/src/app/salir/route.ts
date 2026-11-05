import type { NextRequest } from "next/server";
import { REALMS } from "@/lib/realms";
import { signOut } from "@/lib/server/auth";
import { redirectTo } from "@/lib/server/redirect";

export async function GET(request: NextRequest) {
  await signOut("agency");
  return redirectTo(request, REALMS.agency.login);
}
