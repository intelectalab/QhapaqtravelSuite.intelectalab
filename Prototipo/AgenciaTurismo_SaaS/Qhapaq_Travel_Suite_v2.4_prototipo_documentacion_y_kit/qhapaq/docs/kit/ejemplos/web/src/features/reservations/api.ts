"use client";

/**
 * Hooks de TanStack Query para Reservas (spec 04 §6). Patrón para todos los módulos:
 *  - Claves: ["t", tenantId, recurso, …] (cambiar de tenant/usuario nunca mezcla caché).
 *  - Listados con paginación por cursor (`page[cursor]` → `meta.next_cursor`) con useInfiniteQuery.
 *  - Mutaciones con `Idempotency-Key` (del formulario) e `If-Match` (lock_version leído); al terminar se
 *    invalidan detalle y listados. 409 STALE_VERSION → se invalida el detalle para que el usuario vea la versión nueva.
 *  - Nada de cálculos de precio/penalidad en el cliente: la vista previa la calcula la API.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useTenantKey } from "@/lib/access/access-context";
import type { components } from "@/lib/api/schema";

export type Reservation = components["schemas"]["BookingReservation"];

/**
 * El ReservationResource de ejemplo agrega `status_label` y `services` (con `cost_amount`/`margin_pct` SOLO si el rol
 * puede verlos). El contrato aún no los declara: Supuesto, proponer agregarlos a la spec 04 §6.
 */
export type ReservationDetail = Reservation & {
  status_label?: string | null;
  services?: Array<{
    id: string;
    code: string;
    name: string;
    service_date: string;
    status: string;
    currency: string;
    price_amount: string;
    cost_amount?: string;
    margin_pct?: string | null;
  }>;
};

export type ReservationFilters = { status?: string; channel?: string; q?: string; sort?: string };

export function useReservations(filters: ReservationFilters, pageSize = 25) {
  const tk = useTenantKey();
  return useInfiniteQuery({
    queryKey: [...tk, "reservations", "list", filters, pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await browserApi.GET("/api/v1/reservations", {
        params: {
          query: {
            "filter[status]": filters.status,
            "filter[channel]": filters.channel,
            "filter[q]": filters.q,
            sort: filters.sort ?? "-created_at",
            "page[size]": pageSize,
            "page[cursor]": pageParam,
          },
        },
        signal,
      });
      return data!; // onResponse ya lanzó ApiError si no fue 2xx
    },
    getNextPageParam: (last) => last.meta?.next_cursor ?? undefined,
    // Ventas: el servidor fuerza filter[owner]=me (SEC-BR-09); el cliente no envía owner.
  });
}

export function useReservation(idOrCode: string) {
  const tk = useTenantKey();
  return useQuery({
    queryKey: [...tk, "reservations", "detail", idOrCode],
    queryFn: async ({ signal }) => {
      const { data } = await browserApi.GET("/api/v1/reservations/{id}", { params: { path: { id: idOrCode } }, signal });
      return data!.data as ReservationDetail;
    },
    retry: (count, err) => !(isApiError(err) && [403, 404].includes(err.status)) && count < 2,
  });
}

/** Vista previa de cancelación: líneas, penalidad, reembolso y efectos calculados por el servidor (spec 04 §4.6). */
export function useCancellationPreview(reservationId: string, enabled: boolean) {
  const tk = useTenantKey();
  return useQuery({
    queryKey: [...tk, "reservations", "detail", reservationId, "cancellation-preview"],
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await browserApi.POST("/api/v1/reservations/{id}/cancellation/preview", {
        params: { path: { id: reservationId } },
        body: {},
      });
      // Respuesta GenericObject en el contrato. Campos esperados (spec 04 §4.6): penalty, refund, owed, lines[].
      return (data?.data ?? {}) as { penalty?: string; refund?: string; owed?: string; currency?: string };
    },
  });
}

export type CancelInput = {
  reservationId: string;
  lockVersion: number;
  idempotencyKey: string;
  reason: string;
  detail: string;
};

export function useCancelReservation() {
  const qc = useQueryClient();
  const tk = useTenantKey();
  return useMutation({
    mutationFn: async (v: CancelInput) => {
      const { data } = await browserApi.POST("/api/v1/reservations/{id}/cancel", {
        params: {
          path: { id: v.reservationId },
          header: { "Idempotency-Key": v.idempotencyKey, "If-Match": String(v.lockVersion) },
        },
        body: { reason: v.reason, detail: v.detail },
      });
      return data!.data as Reservation;
    },
    // Reintento automático solo para errores transitorios; la MISMA Idempotency-Key evita duplicar la cancelación.
    retry: (count, err) => isApiError(err) && err.isRetryable && count < 3,
    onSettled: (_d, err, v) => {
      void qc.invalidateQueries({ queryKey: [...tk, "reservations", "detail", v.reservationId] });
      if (!err) void qc.invalidateQueries({ queryKey: [...tk, "reservations", "list"] });
    },
  });
}
