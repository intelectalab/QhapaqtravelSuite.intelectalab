"use client";

import { CheckCircle2, Clock, KeyRound, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmRequest, rejectRequest } from "@/app/(proveedor)/proveedor/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { SupplierRequest } from "@/lib/supplier-portal";

const initial: StepResult = { message: null, done: false };

function Summary({ row }: { row: SupplierRequest }) {
  return (
    <div className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">
      <b className="block text-[13.5px] text-fg">{row.service}</b>
      {row.holder} · {row.pax} pax · {formatDate(row.date)} · tarifa neta {formatMoney(row.net_cost, row.currency)}
    </div>
  );
}

export function ConfirmPanel({ row, contact, size = "md", asIcon = false }: { row: SupplierRequest; contact: string; size?: "md" | "sm"; asIcon?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Confirmar"
      icon={<CheckCircle2 size={16} />}
      variant="primary"
      size={size}
      formId={`confirmar-${row.code}`}
      trigger={asIcon ? (open) => <RowIcon tone="edit" label="Confirmar" icon={<CheckCircle2 size={15} />} onClick={open} /> : undefined}
      title="Confirmar servicio"
      description="El código se imprime en el voucher del pasajero y se valida en su recepción."
      submitLabel="Confirmar servicio"
      action={confirmRequest.bind(null, row.code)}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <Summary row={row} />
          <input type="hidden" name="lock_version" value={row.lock_version} />
          <TextField label="Código de confirmación" name="confirmation_code" required minLength={4} maxLength={40} icon={<KeyRound size={17} />} placeholder="TR-55890" hint="Mínimo 4 caracteres. Se guarda en mayúsculas." />
          <TextField label="Hora del servicio" name="service_time" type="time" defaultValue={row.time ?? ""} icon={<Clock size={17} />} hint="Ajústela si difiere de la solicitada." />
          <TextField label="Confirmado por" name="confirmed_by_name" maxLength={120} defaultValue={contact} icon={<UserRound size={17} />} />
          <TextArea label="Observación" name="note" rows={3} maxLength={500} placeholder="Opcional" />
        </>
      )}
    </PanelAction>
  );
}

export function RejectPanel({ row, reasons, today, size = "md", asIcon = false }: { row: SupplierRequest; reasons: string[]; today: string; size?: "md" | "sm"; asIcon?: boolean }) {
  const router = useRouter();
  const [alternative, setAlternative] = useState(false);
  return (
    <PanelAction<StepResult>
      label="Rechazar"
      icon={<XCircle size={16} />}
      variant="secondary"
      size={size}
      formId={`rechazar-${row.code}`}
      trigger={asIcon ? (open) => <RowIcon tone="delete" label="Rechazar" icon={<XCircle size={15} />} onClick={open} /> : undefined}
      title="Rechazar servicio"
      description="La agencia recibe el motivo y busca otra opción para el pasajero. Si puede atenderlo otro día, propóngalo."
      submitLabel="Enviar rechazo"
      action={rejectRequest.bind(null, row.code)}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <Summary row={row} />
          <input type="hidden" name="lock_version" value={row.lock_version} />
          <SelectField label="Motivo" name="reason" placeholder="Elija el motivo" options={reasons.map((value) => ({ value, label: value }))} />
          <TextArea label="Detalle" name="note" rows={3} required minLength={5} maxLength={1000} placeholder="Explique la situación para que la agencia pueda resolverla." />
          <SwitchField label="Proponer otra fecha" name="propose_alternative" hint="Se crea un servicio alternativo para que la agencia lo solicite." checked={alternative} onCheckedChange={setAlternative} />
          {alternative && <TextField label="Fecha alternativa" name="alt_date" type="date" min={today} required />}
        </>
      )}
    </PanelAction>
  );
}
