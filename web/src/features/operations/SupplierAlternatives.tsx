"use client";

import { ArrowRight, Check, KeyRound, Repeat2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { SupplierAlternative, SupplierAlternativeList } from "@/lib/operations";
import { toneStyle } from "@/lib/tone";
import { Notice } from "./OpsBits";
import { ConfirmNote, OpsStep } from "./OpsStep";

function Change({ label, before, after }: { label: string; before: string; after: string | null }) {
  const changed = after !== null && after !== before;
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="w-[72px] flex-none text-fg-3">{label}</span>
      <span className={cn("truncate", changed && "text-fg-3 line-through")}>{before}</span>
      {changed && (
        <>
          <ArrowRight size={13} className="flex-none text-[var(--tint)]" />
          <b className="truncate font-semibold text-[var(--tint)]">{after}</b>
        </>
      )}
    </div>
  );
}

function AlternativeCard({ row, canReview, index }: { row: SupplierAlternative; canReview: boolean; index: number }) {
  const currency = row.proposal.currency;
  return (
    <li style={{ ...toneStyle(row.hold_expired ? "warn" : "violet"), animationDelay: `${index * 50}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-[14px] border border-[color-mix(in_srgb,var(--tint)_28%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <b className="block truncate text-[13.5px] font-semibold">{row.current.name}</b>
          <span className="block truncate text-xs text-fg-3">
            {row.provider.name} · {row.order ? <Link href={`/operaciones/ordenes/${row.order}`} className="hover:text-accent hover:underline">{row.order}</Link> : <Link href={`/reservas/${row.reservation.code}`} className="hover:text-accent hover:underline">{row.reservation.code}</Link>} · {row.current.pax} pax
          </span>
        </span>
        <span className="flex-none rounded-full bg-[var(--tint)] px-2 py-0.5 text-[11px] font-semibold text-white">{row.kind}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1 rounded-[10px] bg-surface px-3 py-2">
        <Change label="Fecha" before={formatDate(row.current.date)} after={row.proposal.date ? formatDate(row.proposal.date) : null} />
        <Change label="Servicio" before={row.current.name} after={row.proposal.service?.name ?? null} />
        <Change label="Tarifa neta" before={formatMoney(row.current.net_cost, currency)} after={row.proposal.net_cost !== null ? formatMoney(row.proposal.net_cost, currency) : null} />
      </div>
      <p className="mt-2 text-[12.5px] text-fg-2">{row.note}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-xs", row.hold_expired ? "font-semibold text-warn" : "text-fg-3")}>{row.hold_until ? `Bloqueo hasta el ${formatDate(row.hold_until)}` : "Sin bloqueo"}{row.responded_by ? ` · ${row.responded_by}` : ""}</span>
        {canReview && row.service.open && (
          <span className="flex gap-1.5">
            <OpsStep step="alternative_reject" target={row.id} formKey={`${row.id}-reject`} label="No aceptar" icon={<X size={15} />} size="sm" title="No aceptar la alternativa" description={`${row.provider.name} · ${row.current.name}`} submitLabel="Enviar respuesta">
              <ConfirmNote>La solicitud original sigue por responder y el proveedor recibe tu motivo.</ConfirmNote>
              <TextArea label="Motivo para el proveedor" name="note" rows={3} required minLength={5} maxLength={500} />
            </OpsStep>
            <OpsStep step="alternative_accept" target={row.id} formKey={`${row.id}-accept`} label="Aceptar" icon={<Check size={15} />} size="sm" variant="primary" title="Aceptar la alternativa" description={`${row.provider.name} · ${row.current.name}`} submitLabel="Aceptar alternativa">
              <ConfirmNote tone="warn">Se aplican al servicio la fecha, el servicio y la tarifa neta propuestos. Si cambia la fecha, los recursos asignados se liberan para volver a asignarlos.</ConfirmNote>
              <TextField label="Código de confirmación" name="confirmation_code" minLength={4} maxLength={40} icon={<KeyRound size={17} />} hint="Si el proveedor ya te dio el código, el servicio queda confirmado. Si no, se le reenvía la solicitud para que confirme." />
              <TextArea label="Nota" name="note" rows={2} maxLength={500} placeholder="Opcional" />
            </OpsStep>
          </span>
        )}
      </div>
    </li>
  );
}

export function SupplierAlternativesNotice({ data, scope }: { data: SupplierAlternativeList; scope: "all" | "order" }) {
  const [open, setOpen] = useState(false);
  if (data.rows.length === 0) return null;
  const count = data.rows.length;
  return (
    <>
      <Notice tone="violet" icon={<Repeat2 size={16} />} action={<Button size="sm" onClick={() => setOpen(true)}>Revisar</Button>}>
        <b className="font-semibold">{count === 1 ? "Un proveedor propuso una alternativa." : `${count} alternativas de proveedores por revisar.`}</b> {scope === "order" ? "El servicio sigue sin confirmar hasta que decidas." : "Los servicios siguen sin confirmar hasta que Operaciones decida."}
      </Notice>
      <SidePanel open={open} onOpenChange={setOpen} title="Alternativas de proveedores" description="Compara lo solicitado con lo que propone el proveedor y decide." size="wide">
        <ul className="flex flex-col gap-3">
          {data.rows.map((row, index) => (
            <AlternativeCard key={row.id} row={row} canReview={data.can.review} index={index} />
          ))}
        </ul>
      </SidePanel>
    </>
  );
}
