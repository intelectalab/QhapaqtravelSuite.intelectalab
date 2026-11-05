import { NextResponse, type NextRequest } from "next/server";
import { REALMS } from "@/lib/realms";
import { signOut } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  await signOut("agency");
  return NextResponse.redirect(new URL(REALMS.agency.login, request.url));
}
