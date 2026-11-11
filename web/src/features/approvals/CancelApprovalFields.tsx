"use client";

import { useEffect, useState, useTransition } from "react";
import { loadCancellation } from "@/app/(backoffice)/aprobaciones/actions";
import { SelectField } from "@/components/ui/SelectField";
import { formatDate, formatMoney } from "@/lib/format";
import type { ReservationCancellation } from "@/lib/reservations";

function Total({ label, value, currency, tone }: { label: string; value: string; currency: string; tone?: string }) {
  return (
    <div className="lift rounded-[12px] bg-surface-2 px-3 py-2">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <p className={`font-mono text-[14px] font-bold ${tone ?? ""}`}>{formatMoney(Number(value), currency)}</p>
    </div>
  );
}

export function CancelApprovalFields({ reservation, reasons, reason }: { reservation: string; reasons: string[]; reason?: string }) {
  const [preview, setPreview] = useState<ReservationCancellation | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const result = await loadCancellation(reservation);
      setPreview(result);
      setFailed(result === null);
    });
  }, [reservation]);

  return (
    <div className="flex flex-col gap-3">
      <SelectField label="Motivo de la anulación" name="cancel_reason" options={reasons.map((value) => ({ value, label: value }))} defaultValue={reason && reasons.includes(reason) ? reason : (reasons[0] ?? "Otro")} />
      {pending && <p className="text-[12.5px] text-fg-3">Calculando penalidades por servicio…</p>}
      {failed && <p className="text-[12.5px] text-bad">No pudimos calcular las penalidades. Revísalas en la reserva antes de aprobar.</p>}
      {preview && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Total label="Penalidad" value={preview.penalty} currency={preview.currency} tone="text-bad" />
            <Total label="Se devuelve" value={preview.refund} currency={preview.currency} tone="text-ok" />
            <Total label="Queda por cobrar" value={preview.owed} currency={preview.currency} />
          </div>
          <ul className="flex flex-col gap-1.5">
            {preview.lines.map((line) => (
              <li key={line.code} className="flex items-start justify-between gap-3 rounded-[10px] border border-line-2 px-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <b className="block truncate font-semibold">{line.name}</b>
                  <span className="text-fg-3">{formatDate(line.date)} · faltan {line.days} días · {line.policy}</span>
                </span>
                <span className="flex-none text-right font-mono">
                  {line.pct} %
                  <span className="block text-fg-3">{formatMoney(Number(line.penalty), preview.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-fg-3">Pagado {formatMoney(Number(preview.paid), preview.currency)} de {formatMoney(Number(preview.total), preview.currency)}. Al aprobar se anulan los servicios y vouchers, se cancela lo pendiente por cobrar y se registra el reembolso.</p>
        </>
      )}
    </div>
  );
}
