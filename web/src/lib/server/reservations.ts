import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ChangeOptions, Occupancy, DirectFormOptions, ReservationCancellation, ReservationDetail, ReservationFeedback, ReservationHistoryEvent, ReservationList, ReservationListMeta, ReservationPaxMessage, ReservationRow, ReservationWebSnapshot } from "@/lib/reservations";
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

export const getOccupancy = (month?: string) => get<Occupancy>(`/reservations/occupancy${month && /^\d{4}-\d{2}$/.test(month) ? `?month=${month}` : ""}`);

export const getReservation = cache(async (code: string): Promise<ReservationDetail> => (await get<ReservationDetail>(`/reservations/${encodeURIComponent(code)}`)) ?? notFound());

export const getReservationCancellation = async (code: string): Promise<ReservationCancellation | null> => get<ReservationCancellation>(`/reservations/${encodeURIComponent(code)}/cancellation/preview`, "POST");

export const getChangeOptions = async (code: string): Promise<ChangeOptions | null> => get<ChangeOptions>(`/reservations/${encodeURIComponent(code)}/changes/options`);

const section = <T,>(code: string, path: string) => get<T>(`/reservations/${encodeURIComponent(code)}/${path}`);

export const getReservationWebSnapshot = (code: string) => section<ReservationWebSnapshot | null>(code, "web-snapshot");

export const getReservationFeedback = (code: string) => section<ReservationFeedback[]>(code, "pax-feedback");

export const getReservationPaxMessages = (code: string) => section<ReservationPaxMessage[]>(code, "pax-messages");

export async function getReservationHistory(code: string): Promise<ReservationHistoryEvent[]> {
  const result = await fetchPages<ReservationHistoryEvent, unknown>(`/reservations/${encodeURIComponent(code)}/history`, 500);
  return result.ok && result.data ? result.data.data : [];
}

export const getDirectFormOptions = async (): Promise<DirectFormOptions | null> => get<DirectFormOptions>("/reservations/form-options");
