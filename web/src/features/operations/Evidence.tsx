"use client";

import { CheckCheck, FileText, ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent } from "react";
import { uploadEvidence, type OpsState } from "@/app/(backoffice)/operaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { SelectField } from "@/components/ui/SelectField";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatFileSize, shortName } from "@/lib/format";
import { COMPLETABLE_SERVICE, EVIDENCE_RULES, SOURCE_LABEL, type EvidenceFile, type EvidenceRules, type OrderDetail } from "@/lib/operations";
import { QuickError } from "./OrderActions";
import { ConfirmNote, OpsStep } from "./OpsStep";

type Service = OrderDetail["services"][number];

const KIND_LABEL: Record<string, string> = { "application/pdf": "PDF" };

const extensionLabel = (rules: EvidenceRules) => [...new Set(rules.mimes.map((mime) => KIND_LABEL[mime] ?? mime.replace("image/", "").replace("jpeg", "jpg").toUpperCase()))].join(", ");

export function ServiceCompleteAction({ service, today, orderCode }: { service: Service; today: string; orderCode: string }) {
  if (!COMPLETABLE_SERVICE.includes(service.status)) return null;
  if (service.date > today) return <RowIcon tone="neutral" label="Marcar como completado" icon={<CheckCheck size={15} />} disabledHint={`Podrás completarlo desde el ${formatDate(service.date)}`} />;
  return (
    <OpsStep
      step="service_complete"
      target={service.id}
      version={service.lock_version}
      formKey={`${orderCode}-${service.code}`}
      label="Marcar como completado"
      title="Marcar como completado"
      description={`${service.name} · ${formatDate(service.date)}${service.time ? ` ${service.time}` : ""}`}
      submitLabel="Marcar como completado"
      trigger={(open) => <RowIcon tone="view" label="Marcar como completado" icon={<CheckCheck size={15} />} onClick={open} />}
    >
      <ConfirmNote>El servicio queda como prestado y, si tiene guía, conductor o vehículo, su asignación se da por finalizada. Es una de las condiciones para cerrar la operación.</ConfirmNote>
      <TextArea label="Observación" name="note" rows={3} maxLength={500} hint="Opcional. Queda en el historial del servicio." placeholder="El grupo llegó con 20 minutos de retraso; el proveedor cumplió el itinerario." />
    </OpsStep>
  );
}

interface EvidenceSectionProps {
  scope: "order" | "incident";
  target: string;
  files: EvidenceFile[];
  canUpload: boolean;
  canRemove: boolean;
  services?: Service[];
  rules?: EvidenceRules;
  emptyText: string;
}

interface UploadLine {
  name: string;
  state: "pending" | "done" | "failed";
  message?: string;
}

export function EvidenceSection({ scope, target, files, canUpload, canRemove, services = [], rules = EVIDENCE_RULES, emptyText }: EvidenceSectionProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [service, setService] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lines, setLines] = useState<UploadLine[]>([]);
  const [pending, start] = useTransition();
  const maxLabel = formatFileSize(rules.max_bytes);
  const serviceOptions = [{ value: "", label: "General (sin servicio)" }, ...services.filter((item) => item.status !== "cancelado").map((item) => ({ value: item.code, label: item.name, hint: formatDate(item.date) }))];

  const send = (chosen: File[]) => {
    if (chosen.length === 0 || pending) return;
    const queue: UploadLine[] = chosen.map((file) => ({ name: file.name, state: "pending" }));
    setLines(queue);
    start(async () => {
      let uploaded = 0;
      for (const [index, file] of chosen.entries()) {
        const local = file.type && !rules.mimes.includes(file.type.toLowerCase()) ? `Formato no admitido. Usa ${extensionLabel(rules)}.` : file.size > rules.max_bytes ? `Pesa ${formatFileSize(file.size)}; el máximo es ${maxLabel}.` : null;
        let result: OpsState | null = local ? { done: false, message: local } : null;
        if (!result) {
          const form = new FormData();
          form.set("file", file);
          if (service) form.set("reservation_service_id", service);
          result = await uploadEvidence(scope, target, form);
        }
        if (result.done) uploaded += 1;
        setLines((current) => current.map((line, position) => (position === index ? { ...line, state: result.done ? "done" : "failed", message: result.message ?? undefined } : line)));
      }
      if (uploaded > 0) router.refresh();
      if (uploaded === chosen.length) setTimeout(() => setLines([]), 2400);
    });
  };

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (canUpload) send(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex flex-col gap-3">
      {canUpload && (
        <>
          {scope === "order" && services.length > 0 && <SelectField label="Asociar a" name="evidence_service" options={serviceOptions} defaultValue="" onChange={setService} hint="Elige el servicio que respalda o déjala como evidencia general de la orden." />}
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={cn(
              "group flex cursor-pointer items-center gap-3 rounded-tile border border-dashed px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--tint)]",
              dragging ? "border-[var(--tint)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))]" : "border-line",
              pending && "pointer-events-none opacity-70",
            )}
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <UploadCloud size={19} />
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="block font-semibold">{pending ? "Subiendo evidencias…" : dragging ? "Suelta los archivos aquí" : "Arrastra fotos o un PDF, o elige archivos"}</b>
              <span className="block text-[12px] text-fg-3">
                {extensionLabel(rules)} · hasta {maxLabel} por archivo
              </span>
            </span>
            <input
              ref={input}
              type="file"
              multiple
              accept={rules.mimes.join(",")}
              className="sr-only"
              onChange={(event) => {
                send(Array.from(event.target.files ?? []));
                if (input.current) input.current.value = "";
              }}
            />
          </label>
          {lines.length > 0 && (
            <ul className="flex flex-col gap-1">
              {lines.map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 flex-none rounded-full", line.state === "done" ? "bg-ok" : line.state === "failed" ? "bg-bad" : "animate-pulse bg-[var(--tint)]")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{line.name}</span>
                    <span className="text-fg-3">{line.state === "done" ? "Subida" : line.state === "failed" ? "No se subió" : "Subiendo"}</span>
                  </span>
                  {line.message && <QuickError message={line.message} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {files.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">{emptyText}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.map((file, index) => {
            const Icon = file.mime.startsWith("image/") ? ImageIcon : FileText;
            const link = `/operaciones/evidencias/${encodeURIComponent(file.id)}`;
            const tag = file.service?.name ?? (file.incident ? `Incidencia ${file.incident}` : scope === "order" ? "General" : null);
            return (
              <li key={file.id} style={{ animationDelay: `${index * 40}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-[12px] px-3 py-2.5", SOFT_TINT)}>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-surface text-[var(--tint)]">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] font-semibold">{file.name}</b>
                  <span className="block truncate text-xs text-fg-3">
                    {[tag, formatFileSize(file.size), SOURCE_LABEL[file.source] ?? file.source, file.by ? shortName(file.by) : null, formatDateTime(file.at, false)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-none gap-1.5">
                  <RowIcon tone="view" label="Ver evidencia" onClick={() => window.open(link, "_blank", "noopener")} />
                  {canRemove && (
                    <OpsStep
                      step="evidence_remove"
                      target={file.id}
                      label="Retirar evidencia"
                      title="Retirar evidencia"
                      description={file.name}
                      submitLabel="Retirar"
                      trigger={(open) => <RowIcon tone="delete" label="Retirar evidencia" icon={<Trash2 size={15} />} onClick={open} />}
                    >
                      <ConfirmNote tone="warn">La evidencia deja de contar para el cierre, pero el archivo se conserva con el motivo en la auditoría.</ConfirmNote>
                      <TextArea label="Motivo" name="reason" rows={3} required minLength={5} maxLength={500} placeholder="Foto repetida del mismo traslado." />
                    </OpsStep>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
