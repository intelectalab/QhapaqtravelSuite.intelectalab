"use client";

/**
 * Convertir cotización en reserva — POST /api/v1/quotes/{id}/convert (operationId quotesConvert).
 * Contrato: Idempotency-Key + If-Match obligatorios (los tipos generados lo exigen en `params.header`).
 *
 *   const idem = useIdempotencyKey();               // una clave por apertura del diálogo de conversión
 *   const convert = useConvertQuote();
 *   convert.mutate({ quoteId, lockVersion: quote.lock_version, idempotencyKey: idem.key },
 *     { onSuccess: (r) => { idem.reset(); router.push(`/reservas/${r.reservation.code}`); } });
 *
 * Respuesta (spec 04 §4.3 y backend de ejemplo): 201 nueva reserva · 200 ya estaba convertida (`meta.idempotent`).
 * El contrato declara `data: QuoteQuote` (Por definir, ver QuoteConversionController): se tipa explícitamente aquí.
 * Errores: 409 RT-3 (no aprobada), 409 RT-4 (sin cupo, `details.alternatives`), 409 STALE_VERSION, 403 SEC-BR-09.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useTenantKey } from "@/lib/access/access-context";
import type { Reservation } from "@/features/reservations/api";

export type ConvertInput = { quoteId: string; lockVersion: number; idempotencyKey: string; notes?: string };
export type ConvertResult = { reservation: Reservation; idempotent: boolean };

export function useConvertQuote() {
  const qc = useQueryClient();
  const tk = useTenantKey();

  return useMutation({
    mutationFn: async (v: ConvertInput): Promise<ConvertResult> => {
      const { data } = await browserApi.POST("/api/v1/quotes/{id}/convert", {
        params: {
          path: { id: v.quoteId },
          header: { "Idempotency-Key": v.idempotencyKey, "If-Match": String(v.lockVersion) },
        },
        body: v.notes ? { notes: v.notes } : {},
      });
      const body = data as unknown as { data: Reservation; meta?: { idempotent?: boolean } };
      return { reservation: body.data, idempotent: Boolean(body.meta?.idempotent) };
    },
    retry: (count, err) => isApiError(err) && err.isRetryable && count < 3,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...tk, "quotes"] });
      void qc.invalidateQueries({ queryKey: [...tk, "reservations", "list"] });
    },
    onError: (err, v) => {
      // 409 STALE_VERSION: otro usuario cambió la cotización → recargarla (el diálogo muestra el aviso).
      if (isApiError(err) && err.isStale) void qc.invalidateQueries({ queryKey: [...tk, "quotes", "detail", v.quoteId] });
    },
  });
}
