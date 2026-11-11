"use client";

import { HeartPulse, IdCard, Phone, Send, Upload, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestTravelDocs, saveEmergencyContact, saveSpecialAttention, uploadTravelDoc } from "@/app/(backoffice)/operaciones/documentos-viaje/actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { FilePicker } from "@/components/ui/FilePicker";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate } from "@/lib/format";
import type { TravelDocDetail, TravelDocDetailPassenger, TravelDocument } from "@/lib/operations";
import type { StepResult } from "@/lib/server/resource";
import { ConfirmNote } from "./OpsStep";

const initial: StepResult = { message: null, done: false };

const NUMBER_LABEL: Record<string, string> = { id_doc: "Número de documento", insurance: "N.º de póliza", minor_auth: "N.º de permiso o partida", visa: "N.º de visa" };

export function UploadDocAction({ document, passenger, target }: { document: TravelDocument; passenger: string; target: string }) {
  const router = useRouter();
  const replacing = document.has_file;
  return (
    <PanelAction<StepResult>
      label={replacing ? "Reemplazar archivo" : "Cargar archivo"}
      formId={`doc-upload-${document.id}`}
      title={replacing ? `Reemplazar ${document.label.toLowerCase()}` : `Cargar ${document.label.toLowerCase()}`}
      description={passenger}
      submitLabel={replacing ? "Reemplazar" : "Cargar documento"}
      action={uploadTravelDoc.bind(null, target)}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={(open) => <RowIcon tone="neutral" label={replacing ? "Reemplazar archivo" : "Cargar archivo"} icon={<Upload size={15} />} onClick={open} />}
    >
      {() => (
        <>
          {replacing && <ConfirmNote tone="warn">El archivo actual ({document.file}) queda en el historial y el documento vuelve a quedar por validar.</ConfirmNote>}
          <FilePicker label="Archivo" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" formats="PDF, JPG o PNG" maxKb={10240} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={NUMBER_LABEL[document.type] ?? "Referencia"} name="doc_number" maxLength={40} defaultValue={document.number ?? ""} icon={<IdCard size={16} />} />
            {["id_doc", "insurance", "visa"].includes(document.type) && <TextField label={document.type === "insurance" ? "Cobertura hasta" : "Vence"} name="expiry_date" type="date" defaultValue={document.expiry ?? ""} hint={document.min_expiry ? `Debe vencer después del ${formatDate(document.min_expiry)}` : undefined} />}
          </div>
          <TextArea label="Nota" name="note" rows={2} maxLength={300} placeholder="Opcional" />
          <p className="text-[12px] text-fg-3">El archivo pasa por el antivirus antes de guardarse. Solo Operaciones puede abrirlo.</p>
        </>
      )}
    </PanelAction>
  );
}

export function ContactAction({ passenger, relations, target }: { passenger: TravelDocDetailPassenger; relations: string[]; target: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={passenger.contact ? "Editar contacto" : "Registrar contacto"}
      icon={<Phone size={15} />}
      size="sm"
      formId={`doc-contact-${passenger.id}`}
      title="Contacto de emergencia"
      description={passenger.name}
      submitLabel="Guardar contacto"
      action={saveEmergencyContact.bind(null, target)}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required minLength={3} maxLength={150} defaultValue={passenger.contact?.name ?? ""} icon={<UserRound size={16} />} />
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <TextField label="Teléfono" name="phone" required minLength={6} maxLength={30} defaultValue={passenger.contact?.phone ?? ""} icon={<Phone size={16} />} placeholder="+51 984 112 233" />
            <SelectField label="Relación" name="relation" options={relations.map((value) => ({ value, label: value }))} defaultValue={passenger.contact?.relation ?? "Familiar"} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function AttentionFields({ passenger }: { passenger: TravelDocDetailPassenger }) {
  const [flag, setFlag] = useState(passenger.attention?.flag ?? false);
  return (
    <>
      <ConfirmNote>Registra solo la indicación operativa: dieta, movilidad, asiento o ritmo. No anotes diagnósticos ni información clínica.</ConfirmNote>
      <SwitchField label="Requiere atención especial" name="requires_attention" checked={flag} onCheckedChange={setFlag} />
      <TextArea label="Nota operativa" name="operational_note" rows={3} maxLength={300} required={flag} defaultValue={passenger.attention?.note ?? ""} placeholder="Dieta vegetariana; asiento delantero en el bus." />
    </>
  );
}

export function AttentionAction({ passenger, target }: { passenger: TravelDocDetailPassenger; target: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={passenger.attention ? "Editar atención" : "Atención especial"}
      icon={<HeartPulse size={15} />}
      size="sm"
      formId={`doc-attention-${passenger.id}`}
      title="Atención especial en la operación"
      description={passenger.name}
      submitLabel="Guardar"
      action={saveSpecialAttention.bind(null, target)}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => <AttentionFields passenger={passenger} />}
    </PanelAction>
  );
}

export function RequestDocsAction({ data }: { data: TravelDocDetail }) {
  const router = useRouter();
  const { request } = data;
  return (
    <PanelAction<StepResult>
      label="Solicitar documentos al cliente"
      icon={<Send size={16} />}
      variant="primary"
      formId={`doc-request-${data.code}`}
      title="Solicitar documentos"
      description={`${data.client} · ${request.email ?? "sin correo registrado"}`}
      submitLabel="Enviar solicitud"
      action={requestTravelDocs.bind(null, data.code)}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <ConfirmNote tone={request.pending > 0 ? "neutral" : "warn"}>
            {request.pending > 0 ? `El cliente recibe el detalle de ${request.pending === 1 ? "1 documento pendiente u observado" : `${request.pending} documentos pendientes u observados`} y el enlace al portal para cargarlos.` : "El checklist no tiene documentos pendientes por solicitar."}
          </ConfirmNote>
          <ChipToggleGroup label="Canales" name="channels" options={request.channels.map((value) => ({ value, label: value }))} defaultValue={request.channels} hint="El correo sale ahora. WhatsApp todavía no tiene proveedor de envío conectado." />
        </>
      )}
    </PanelAction>
  );
}
