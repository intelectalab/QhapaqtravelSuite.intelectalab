"use client";

/**
 * Formulario de cancelación de reserva (spec 04 §4.6, E2E-09) — patrón React Hook Form + Zod + errores 422 por campo.
 *
 * - Esquema Zod ESPEJO del FormRequest (`reason` de lista + `detail` obligatorio, RES-BR-30). La API vuelve a validar.
 * - La penalidad/reembolso los calcula la API (POST …/cancellation/preview): el cliente solo los muestra.
 * - Idempotency-Key por apertura del diálogo; If-Match = lock_version de la reserva leída.
 * - data-testid de SELECTORES.md: field:reason (+ option:{motivo}), field:detail, field-error:*, cancellation-penalty,
 *   cancellation-refund, cancellation-confirm. Montos con data-amount (string decimal sin separador de miles).
 * - Motivos: catálogo por definir con negocio (spec 04 §4.6 «motivo de lista»); llegan por props desde la API.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useIdempotencyKey } from "@/lib/api/idempotency";
import { applyServerErrors } from "@/lib/forms/apply-server-errors";
import { useCancellationPreview, useCancelReservation, type ReservationDetail } from "./api";

const schema = z.object({
  reason: z.string().min(1, "Seleccione un motivo."),
  detail: z.string().trim().min(1, "Ingrese el detalle de la cancelación.").max(1000, "Máximo 1 000 caracteres."),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ["reason", "detail"] as const;

type Props = {
  reservation: ReservationDetail;
  reasons: ReadonlyArray<{ code: string; label: string }>;
  onDone: () => void;
};

export function CancelReservationForm({ reservation, reasons, onDone }: Props) {
  const idem = useIdempotencyKey();
  const preview = useCancellationPreview(reservation.id ?? "", true);
  const cancel = useCancelReservation();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: "", detail: "" } });
  const { register, handleSubmit, formState, setError } = form;

  const onSubmit = handleSubmit((values) =>
    cancel.mutate(
      {
        reservationId: reservation.id ?? "",
        lockVersion: reservation.lock_version ?? 0,
        idempotencyKey: idem.key,
        reason: values.reason,
        detail: values.detail,
      },
      {
        onSuccess: () => {
          idem.reset();
          onDone();
        },
        onError: (err) => applyServerErrors(err, setError, FIELDS),
      },
    ),
  );

  const p = preview.data;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <dl className="grid grid-cols-1 gap-2 rounded-sm bg-surface-2 p-3 tablet:grid-cols-2">
        <div>
          <dt className="text-xs text-fg-3">Penalidad</dt>
          <dd data-testid="cancellation-penalty" data-amount={p?.penalty ?? ""} className="font-semibold tabular-nums">
            {preview.isLoading ? "Calculando…" : formatMoney(p?.penalty, p?.currency ?? reservation.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-3">Reembolso</dt>
          <dd data-testid="cancellation-refund" data-amount={p?.refund ?? ""} className="font-semibold tabular-nums">
            {preview.isLoading ? "Calculando…" : formatMoney(p?.refund, p?.currency ?? reservation.currency)}
          </dd>
        </div>
      </dl>

      <div className="grid gap-1">
        <label htmlFor="cancel-reason" className="text-sm font-medium">
          Motivo <span className="text-bad">*</span>
        </label>
        <select
          id="cancel-reason"
          data-testid="field:reason"
          aria-invalid={Boolean(formState.errors.reason)}
          className="h-control rounded-control border border-line bg-surface px-3"
          {...register("reason")}
        >
          <option value="">Seleccione…</option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code} data-testid={`option:${r.code}`}>
              {r.label}
            </option>
          ))}
        </select>
        {formState.errors.reason && (
          <p data-testid="field-error:reason" role="alert" className="text-xs text-bad">
            {formState.errors.reason.message}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="cancel-detail" className="text-sm font-medium">
          Detalle <span className="text-bad">*</span>
        </label>
        <textarea
          id="cancel-detail"
          data-testid="field:detail"
          rows={3}
          aria-invalid={Boolean(formState.errors.detail)}
          className="rounded-control border border-line bg-surface p-3"
          {...register("detail")}
        />
        {formState.errors.detail && (
          <p data-testid="field-error:detail" role="alert" className="text-xs text-bad">
            {formState.errors.detail.message}
          </p>
        )}
      </div>

      {formState.errors.root?.server && (
        <div role="alert" className="rounded-sm bg-bad-soft p-3 text-sm text-bad">
          {formState.errors.root.server.message}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
        <button type="button" onClick={onDone} className="h-btn rounded-control border border-line px-4">
          Volver
        </button>
        <button
          type="submit"
          data-testid="cancellation-confirm"
          disabled={cancel.isPending || preview.isLoading}
          className="h-btn rounded-control bg-bad px-4 font-semibold text-white disabled:opacity-60"
        >
          {cancel.isPending ? "Cancelando…" : "Cancelar reserva"}
        </button>
      </div>
    </form>
  );
}

/** Formato de presentación (COMPONENTES.md «Montos»): nunca se calcula, solo se formatea el string de la API. */
function formatMoney(amount: string | undefined, currency: string | undefined): string {
  if (amount === undefined || currency === undefined) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(Number(amount));
}
