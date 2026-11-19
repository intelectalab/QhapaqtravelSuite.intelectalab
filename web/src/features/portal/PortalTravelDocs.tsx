"use client";

import { FileBadge2, IdCard, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadTripDocument } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/Badge";
import { DateField } from "@/components/ui/DateField";
import { FilePicker } from "@/components/ui/FilePicker";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { PAX_TYPES, type PortalTravelDoc, type PortalTravelDocPassenger } from "@/lib/portal";
import type { StepResult } from "@/lib/server/resource";
import type { Tone } from "@/lib/tone";
import { rise, RISE, SectionCard } from "./PortalUi";

const initial: StepResult = { message: null, done: false };

const STATES: Record<PortalTravelDoc["status"], { label: string; tone: Tone; hint: string }> = {
  pendiente: { label: "Por enviar", tone: "warn", hint: "Súbelo para que lo revisemos." },
  recibido: { label: "En revisión", tone: "info", hint: "Lo recibimos y lo estamos revisando." },
  completo: { label: "Aprobado", tone: "ok", hint: "Listo para tu viaje." },
  observado: { label: "Por corregir", tone: "bad", hint: "Revisa el motivo y súbelo de nuevo." },
  vencido: { label: "Vencido", tone: "bad", hint: "No cubre las fechas de tu viaje. Sube uno vigente." },
};

const NUMBER_LABEL: Record<string, string> = { id_doc: "Número de documento", insurance: "Número de póliza", minor_auth: "Número de permiso o partida", visa: "Número de visa" };

const WITH_EXPIRY = ["id_doc", "insurance", "visa"];

function UploadAction({ trip, passenger, document }: { trip: string; passenger: PortalTravelDocPassenger; document: PortalTravelDoc }) {
  const router = useRouter();
  const again = document.file !== null;
  return (
    <PanelAction<StepResult>
      label={again ? "Subir de nuevo" : "Subir"}
      icon={<Upload size={14} />}
      variant={document.status === "recibido" ? "ghost" : "primary"}
      size="sm"
      formId={`trip-doc-${passenger.id}-${document.type}`}
      title={`${again ? "Subir de nuevo" : "Subir"}: ${document.label.toLowerCase()}`}
      description={passenger.name}
      submitLabel="Enviar documento"
      action={uploadTripDocument.bind(null, trip, passenger.id, document.type)}
      initial={initial}
      onDone={() => router.refresh()}
      successToast="Recibimos tu documento. Te avisaremos si hace falta algo más."
    >
      {() => (
        <>
          {document.observation && (
            <p className="rounded-tile border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)] px-3 py-2.5 text-[13px] text-fg-2">
              <b className="block font-semibold text-bad">Qué debes corregir</b>
              {document.observation}
            </p>
          )}
          <FilePicker label="Archivo" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" formats="PDF, JPG o PNG" maxKb={10240} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={NUMBER_LABEL[document.type] ?? "Número o referencia"} name="doc_number" maxLength={40} icon={<IdCard size={16} />} />
            {WITH_EXPIRY.includes(document.type) && <DateField label={document.type === "insurance" ? "Cobertura hasta" : "Vence"} name="expiry_date" hint={document.min_expiry ? `Debe vencer después del ${formatDate(document.min_expiry)}` : undefined} />}
          </div>
          <p className="text-[12px] text-fg-3">Revisamos cada archivo para protegerte antes de guardarlo. Solo el equipo de operaciones de la agencia puede abrirlo.</p>
        </>
      )}
    </PanelAction>
  );
}

export function PortalTravelDocs({ trip, passengers }: { trip: string; passengers: PortalTravelDocPassenger[] }) {
  const documents = passengers.flatMap((passenger) => passenger.documents);
  const approved = documents.filter((document) => document.status === "completo").length;
  const missing = documents.filter((document) => ["pendiente", "observado", "vencido"].includes(document.status)).length;

  return (
    <div id="documentos-de-viaje" className="scroll-mt-24">
      <SectionCard icon={FileBadge2} title="Documentos de viaje" aside={`${approved} de ${documents.length} aprobados`}>
        <p className="mb-3 text-[12.5px] text-fg-3">{missing > 0 ? `Te ${missing === 1 ? "falta enviar o corregir 1 documento" : `faltan enviar o corregir ${missing} documentos`}. Súbelos aquí en PDF, JPG o PNG.` : "Ya enviaste todo lo que pedimos. Te avisaremos si hace falta algo más."}</p>
        <div className="flex flex-col gap-4">
          {passengers.map((passenger, index) => (
            <section key={passenger.id} style={rise(index)} className={RISE}>
              <p className="mb-2 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                {passenger.name}
                <span className="font-normal text-fg-3">{PAX_TYPES[passenger.type] ?? passenger.type}</span>
                {passenger.lead && <Badge tone="t1">Titular</Badge>}
              </p>
              <ul className="flex flex-col gap-2">
                {passenger.documents.map((document) => {
                  const state = STATES[document.status];
                  return (
                    <li key={document.type} className={cn("lift flex flex-wrap items-center gap-3 rounded-tile border bg-surface px-3.5 py-3", document.status === "observado" || document.status === "vencido" ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)]" : "border-line")}>
                      <span className="min-w-0 flex-1">
                        <b className="block text-[13.5px] font-semibold">{document.label}</b>
                        <span className="block text-[12px] text-fg-3">{document.file ? `${document.file}${document.sent_by_you ? " · enviado por ti" : ""}` : state.hint}</span>
                        {document.observation && <span className="mt-1 block text-[12.5px] font-medium text-bad">{document.observation}</span>}
                      </span>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      {document.can_upload && <UploadAction trip={trip} passenger={passenger} document={document} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
