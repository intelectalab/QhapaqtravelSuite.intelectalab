import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ChangeOptions, DirectFormOptions, ReservationCancellation, ReservationDetail, ReservationList, ReservationListMeta, ReservationRow } from "@/lib/reservations";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";
import { fetchPages } from "./pages";

async function get<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T | null> {
  const result = await apiFetch<T>(path, { method });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las reservas.");
  return result.data;
}

const EMPTY_LIST: ReservationList = { today: "", can: { modify: false, cancel: false, create: false }, view: { mode: "full", margin: false, cost: false, price: true }, kpis: { confirmed: 0, in_operation: 0, pending: 0, traveling_pax: 0, total: 0 }, items: [] };

export async function listReservations(): Promise<ReservationList> {
  const result = await fetchPages<ReservationRow, ReservationListMeta>("/reservations", 1000);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return EMPTY_LIST;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las reservas.");
  const { today, can, view, kpis } = result.data.meta;
  return { today, can, view, kpis, items: result.data.data };
}

export const getReservation = cache(async (code: string): Promise<ReservationDetail> => (await get<ReservationDetail>(`/reservations/${encodeURIComponent(code)}`)) ?? notFound());

export const getReservationCancellation = async (code: string): Promise<ReservationCancellation | null> => get<ReservationCancellation>(`/reservations/${encodeURIComponent(code)}/cancellation/preview`, "POST");

export const getChangeOptions = async (code: string): Promise<ChangeOptions | null> => get<ChangeOptions>(`/reservations/${encodeURIComponent(code)}/changes/options`);

export const getDirectFormOptions = async (): Promise<DirectFormOptions | null> => get<DirectFormOptions>("/reservations/form-options");
