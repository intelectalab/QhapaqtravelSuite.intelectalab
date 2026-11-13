import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AGENCY_PREVIEW_RETURN, PREVIEW_BACK_COOKIE, previewBack } from "@/lib/agency-preview";
import { REALMS } from "@/lib/realms";
import { sessionToken } from "./session";

const secure = process.env.NODE_ENV === "production";

export async function startPreviewSession(token: string, expiresAt: string, back: string): Promise<boolean> {
  const current = await sessionToken();
  if (!current) return false;
  const store = await cookies();
  const seconds = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const keep = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: seconds + 60 * 60 };
  if (!store.has(AGENCY_PREVIEW_RETURN)) store.set(AGENCY_PREVIEW_RETURN, current, keep);
  store.set(PREVIEW_BACK_COOKIE, back, keep);
  store.set(REALMS.agency.session, token, { httpOnly: true, sameSite: "lax", secure, path: REALMS.agency.path, maxAge: seconds });
  return true;
}

export function endPreviewSession(request: NextRequest): NextResponse {
  const original = request.cookies.get(AGENCY_PREVIEW_RETURN)?.value;
  const response = NextResponse.redirect(new URL(original ? previewBack(request.cookies.get(PREVIEW_BACK_COOKIE)?.value) : REALMS.agency.logout, request.url));
  response.cookies.delete({ name: AGENCY_PREVIEW_RETURN, path: "/" });
  response.cookies.delete({ name: PREVIEW_BACK_COOKIE, path: "/" });
  if (original) response.cookies.set(REALMS.agency.session, original, { httpOnly: true, sameSite: "lax", secure, path: REALMS.agency.path, maxAge: 60 * 60 * REALMS.agency.hours });
  return response;
}
