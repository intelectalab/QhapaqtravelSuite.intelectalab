"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, sendAdmin, text } from "@/lib/server/admin";
import { apiFetch } from "@/lib/server/api";
import type { SiteDesign, SiteDesignOverview, SiteImage } from "@/lib/site-design";

const PATH = "/";

const STUDIO = "/admin/site-design";

export async function saveBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/branding", "PUT", fields(form, ["brand", "accent", "menu", "tile_variant"]), PATH, "No pudimos guardar la apariencia.");
}

export async function resetBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/branding/reset", "POST", { reason: text(form, "reason") }, PATH, "No pudimos restablecer la apariencia.");
}

export type DraftSaveResult = { ok: true; lock_version: number; pending: string[]; draft_updated_at: string } | { ok: false; conflict: boolean; message: string; errors: Record<string, string> };

export type StudioResult = { ok: true; overview: SiteDesignOverview; message: string } | { ok: false; message: string };

export type ImageResult = { ok: true; image: SiteImage } | { ok: false; message: string };

function firstErrors(errors: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([key, messages]) => [key.replace(/^design\./, ""), messages[0] ?? ""]));
}

async function overview(message: string, failure: string): Promise<StudioResult> {
  const result = await apiFetch<SiteDesignOverview>(STUDIO);
  return result.ok && result.data ? { ok: true, overview: result.data, message } : { ok: false, message: result.error?.message ?? failure };
}

export async function saveSiteDraft(design: SiteDesign, lockVersion: number): Promise<DraftSaveResult> {
  const result = await apiFetch<{ lock_version: number; pending: string[]; draft_updated_at: string }>(`${STUDIO}/draft`, { method: "PUT", body: { design, lock_version: lockVersion } });
  if (result.ok && result.data) return { ok: true, ...result.data };
  const errors = firstErrors(result.error?.errors);
  return { ok: false, conflict: result.status === 409, message: Object.values(errors)[0] ?? result.error?.message ?? "No pudimos guardar el borrador.", errors };
}

export async function publishSite(note: string): Promise<StudioResult> {
  const result = await apiFetch<{ version: number }>(`${STUDIO}/publish`, { method: "POST", body: { note: note.trim() || null } });
  if (!result.ok || !result.data) return { ok: false, message: result.error?.message ?? "No pudimos publicar el sitio." };
  return overview(`Publicaste la versión ${result.data.version}. Tus clientes ya ven los cambios.`, "Publicamos el sitio, pero no pudimos recargar el editor.");
}

export async function discardSiteDraft(): Promise<StudioResult> {
  const result = await apiFetch(`${STUDIO}/discard`, { method: "POST", body: {} });
  if (!result.ok) return { ok: false, message: result.error?.message ?? "No pudimos descartar el borrador." };
  return overview("Descartaste los cambios: el borrador vuelve a ser igual al sitio publicado.", "Descartamos el borrador, pero no pudimos recargar el editor.");
}

export async function restoreSiteVersion(version: number): Promise<StudioResult> {
  const result = await apiFetch(`${STUDIO}/versions/${version}/restore`, { method: "POST", body: {} });
  if (!result.ok) return { ok: false, message: result.error?.message ?? "No pudimos recuperar esa versión." };
  return overview(`Copiamos la versión ${version} al borrador. Revísala en la vista previa y publícala si te convence.`, "Recuperamos la versión, pero no pudimos recargar el editor.");
}

export async function uploadSiteImage(form: FormData): Promise<ImageResult> {
  const result = await apiFetch<SiteImage>(`${STUDIO}/images`, { method: "POST", form });
  if (result.ok && result.data) return { ok: true, image: result.data };
  const errors = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
  return { ok: false, message: errors ?? result.error?.message ?? "No pudimos subir la imagen." };
}

export async function deleteSiteImage(id: string): Promise<{ ok: boolean; message: string | null }> {
  const result = await apiFetch(`${STUDIO}/images/${id}`, { method: "DELETE" });
  return { ok: result.ok, message: result.ok ? null : (result.error?.message ?? "No pudimos borrar la imagen.") };
}
