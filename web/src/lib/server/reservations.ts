import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ReservationDetail, ReservationList } from "@/lib/reservations";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las reservas.");
  return result.data;
}

export const listReservations = async (): Promise<ReservationList> => (await get<ReservationList>("/reservations")) ?? { today: "", items: [] };

export const getReservation = cache(async (code: string): Promise<ReservationDetail> => (await get<ReservationDetail>(`/reservations/${encodeURIComponent(code)}`)) ?? notFound());
