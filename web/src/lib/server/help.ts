import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { helpPayload, lockOf, type HelpArticle, type HelpScreen } from "@/lib/help";
import type { Realm } from "@/lib/realms";
import { apiFetch } from "./api";

export interface HelpSendResult<T> {
  state: { message: string | null; done: boolean };
  data: T | null;
}

export async function sendHelp<T>(path: string, method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string, realm?: Realm): Promise<HelpSendResult<T>> {
  const result = await apiFetch<T>(path, { method, body, realm });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { state: { message: firstError ?? result.error?.message ?? failure, done: false }, data: null };
  }
  return { state: { message: null, done: true }, data: result.data };
}

export interface HelpTarget {
  api: string;
  center: string;
  realm?: Realm;
}

export const AGENCY_TARGET: HelpTarget = { api: "/help", center: "/ayuda" };

export const PLATFORM_TARGET: HelpTarget = { api: "/platform/help", center: "/plataforma/ayuda", realm: "platform" };

type State = { message: string | null; done: boolean };

const slugOf = (form: FormData) => encodeURIComponent(String(form.get("slug") ?? ""));

function refresh(target: HelpTarget, slug?: string): void {
  revalidatePath(target.center);
  if (slug) revalidatePath(`${target.center}/${slug}`);
}

export async function createArticle(target: HelpTarget, form: FormData): Promise<State> {
  const result = await sendHelp<HelpArticle>(`${target.api}/articles`, "POST", helpPayload(form), "No pudimos crear el artículo.", target.realm);
  if (!result.state.done || !result.data) return result.state;
  refresh(target);
  redirect(`${target.center}/${encodeURIComponent(result.data.slug)}`);
}

export async function saveArticle(target: HelpTarget, form: FormData): Promise<State> {
  const result = await sendHelp(`${target.api}/articles/${slugOf(form)}`, "PUT", helpPayload(form), "No pudimos guardar el artículo.", target.realm);
  if (result.state.done) refresh(target, slugOf(form));
  return result.state;
}

export async function changeArticle(target: HelpTarget, form: FormData, step: "archive" | "restore" | "adaptation"): Promise<State> {
  const path = `${target.api}/articles/${slugOf(form)}/${step}`;
  const result = step === "adaptation" ? await sendHelp(path, "DELETE", {}, "No pudimos volver a la versión de KipuControl.", target.realm) : await sendHelp(path, "POST", lockOf(form), step === "archive" ? "No pudimos archivar el artículo." : "No pudimos reactivar el artículo.", target.realm);
  if (result.state.done) refresh(target, slugOf(form));
  return result.state;
}

export async function helpScreenResponse(request: NextRequest, apiPath: string, realm?: Realm): Promise<NextResponse> {
  const path = request.nextUrl.searchParams.get("path") ?? "/";
  const result = await apiFetch<HelpScreen>(`${apiPath}?path=${encodeURIComponent(path)}`, { realm });

  if (!result.ok || !result.data) {
    return NextResponse.json({ message: result.error?.message ?? null }, { status: result.status || 503, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
