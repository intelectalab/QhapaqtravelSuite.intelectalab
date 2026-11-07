"use client";

import { FileText, History, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { loadTemplate, restoreTemplate, saveTemplate, testTemplate } from "@/app/(backoffice)/admin/notificaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { TEMPLATE_CHANNELS, type NotificationTemplate, type TemplateChannel, type TemplateResult, VARIABLE_LABELS } from "@/lib/notificationTemplates";

export function TemplateEditor({ event, label }: { event: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<TemplateChannel>("email");
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const apply = (result: TemplateResult) => {
    setMessage(result.message);
    setNotice(result.notice ?? null);
    if (result.template) {
      setTemplate(result.template);
      setSubject(result.template.subject);
      setBody(result.template.body);
    }
  };

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setTemplate(null);
      apply(await loadTemplate(event, channel));
    });
  }, [open, event, channel]);

  const dirty = template !== null && (subject !== template.subject || body !== template.body);
  const tooLong = template?.max_length !== null && template?.max_length !== undefined && body.length > template.max_length;

  const insert = (variable: string) => {
    const token = `{{${variable}}}`;
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const run = (task: () => Promise<TemplateResult>) => startTransition(async () => apply(await task()));

  return (
    <>
      <RowIcon tone="neutral" label={`Plantillas de ${label}`} icon={<FileText size={15} />} onClick={() => setOpen(true)} />
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={`Plantillas · ${label}`}
        description="Cada cambio crea una versión nueva. Los avisos ya enviados conservan el texto con el que salieron."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="dialog-cancel">
              Cerrar
            </Button>
            <Button variant="secondary" icon={<Send size={15} />} disabled={pending || !template || tooLong} onClick={() => run(() => testTemplate(event, channel, subject, body))} data-testid="template-test">
              Enviar prueba
            </Button>
            <Button variant="primary" disabled={pending || !dirty || tooLong} onClick={() => run(() => saveTemplate(event, channel, subject, body))} data-testid="template-save">
              {pending ? "Un momento…" : "Guardar versión"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4" data-testid={`template-editor:${event}`}>
          <div role="tablist" aria-label="Canal" className="grid grid-cols-3 gap-1.5 rounded-control bg-surface-2 p-1">
            {TEMPLATE_CHANNELS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={channel === option.value}
                data-testid={`tab:${option.value}`}
                onClick={() => setChannel(option.value)}
                className={cn("rounded-[10px] px-2 py-2 text-[12.5px] font-semibold transition", channel === option.value ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <FormError message={message} />
          {notice && <p role="status" className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3.5 py-3 text-[13px] text-fg">{notice}</p>}

          {template === null ? (
            <p className="py-10 text-center text-[13px] text-fg-3">{pending ? "Cargando la plantilla…" : "Elige un canal para ver su plantilla."}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
                <Badge tone={template.source === "agencia" ? "t1" : "mute"}>{template.source === "agencia" ? `Versión ${template.version} de la agencia` : "Plantilla del sistema"}</Badge>
                {template.updated_at && template.source === "agencia" && <span>{`Editada el ${formatDateTime(template.updated_at, false)}${template.updated_by ? ` por ${template.updated_by}` : ""}`}</span>}
              </div>

              <TextField label={channel === "email" ? "Asunto" : "Título"} name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} />
              <div>
                <TextArea
                  ref={bodyRef}
                  label="Mensaje"
                  name="body"
                  rows={channel === "push" ? 3 : 8}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={template.max_length ?? 5000}
                  error={tooLong ? `El mensaje push admite hasta ${template.max_length} caracteres.` : null}
                />
                <p className="mt-1.5 text-right font-mono text-[11.5px] text-fg-3">
                  {body.length}
                  {template.max_length ? ` / ${template.max_length}` : ""}
                </p>
              </div>

              <section>
                <h3 className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Insertar dato</h3>
                <div className="flex flex-wrap gap-1.5">
                  {template.variables.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => insert(variable)}
                      data-testid={`template-variable:${variable}`}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] font-medium text-fg-2 transition hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
                    >
                      {VARIABLE_LABELS[variable] ?? variable}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-line-2 bg-surface-2 px-3.5 py-3">
                <h3 className="mb-1 text-[12px] font-semibold text-fg-3">Así se ve la versión guardada, con datos de ejemplo</h3>
                <p className="text-[13px] font-semibold">{template.preview.subject}</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-fg-2">{template.preview.body}</p>
              </section>

              {template.source === "agencia" && (
                <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} disabled={pending} onClick={() => run(() => restoreTemplate(event, channel))} data-testid="template-restore" className="self-start">
                  Volver a la plantilla del sistema
                </Button>
              )}

              {template.versions.length > 0 && (
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2">
                    <History size={14} />
                    Versiones de la agencia
                  </h3>
                  <ul className="text-[12.5px]">
                    {template.versions.map((version) => (
                      <li key={version.id} className="flex items-center gap-2 border-t border-line-2 py-1.5 first:border-t-0">
                        <span className="font-mono text-fg-2">v{version.version}</span>
                        <span className="min-w-0 flex-1 truncate text-fg-3">{`${formatDateTime(version.created_at, false)}${version.created_by ? ` · ${version.created_by}` : ""}`}</span>
                        {version.current && <Badge tone="ok">Vigente</Badge>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </SidePanel>
    </>
  );
}
