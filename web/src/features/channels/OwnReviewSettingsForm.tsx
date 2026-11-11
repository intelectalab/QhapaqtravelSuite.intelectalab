"use client";

import { Loader2, RefreshCw, Save, X } from "lucide-react";
import { useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { exportReviewFeed, saveReviewSettings } from "@/app/(backoffice)/canales/resenas-propias/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { OwnReviewSettings, OwnReviewSettingsValues } from "@/lib/channels";
import { formatDateTime } from "@/lib/format";
import { ReviewToolbarAction } from "./ReviewToolbarAction";

function Block({ title, info, children }: { title: string; info?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="flex items-center gap-1.5 text-[14.5px] font-semibold text-fg">
        {title}
        {info && <InfoTip label={`Sobre ${title.toLowerCase()}`}>{info}</InfoTip>}
      </h3>
      {children}
    </section>
  );
}

export function OwnReviewSettingsForm({ settings, canEdit }: { settings: OwnReviewSettings; canEdit: boolean }) {
  const [values, setValues] = useState<OwnReviewSettingsValues>(settings.values);
  const [word, setWord] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const set = <K extends keyof OwnReviewSettingsValues>(key: K, value: OwnReviewSettingsValues[K]) => setValues({ ...values, [key]: value });
  const setInvite = <K extends keyof OwnReviewSettingsValues["invite"]>(key: K, value: OwnReviewSettingsValues["invite"][K]) => setValues({ ...values, invite: { ...values.invite, [key]: value } });
  const addWord = () => {
    const clean = word.trim().toLowerCase();
    if (clean.length >= 2 && !values.banned_words.includes(clean)) set("banned_words", [...values.banned_words, clean]);
    setWord("");
  };
  const onWordKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addWord();
    }
  };
  const toggleSubrating = (key: string) => set("active_subratings", values.active_subratings.includes(key) ? values.active_subratings.filter((item) => item !== key) : [...values.active_subratings, key]);

  return (
    <div className="grid">
      <Block title="Publicación" info="La regla R-OWN-REVIEWS define desde cuántas estrellas se publica sola y si hay moderación; aquí decides si la moderación se salta para las reseñas sin alertas.">
        <SwitchField label="Publicar automáticamente las reseñas sin alertas" name="auto_publish" checked={values.auto_publish} disabled={!canEdit} onCheckedChange={(checked) => set("auto_publish", checked)} hint="Siempre que el viajero dio su consentimiento y alcanza las estrellas mínimas de la regla." />
        <SwitchField label="Mostrar reseñas en el sitio web" name="show_on_site" checked={values.show_on_site} disabled={!canEdit} onCheckedChange={(checked) => set("show_on_site", checked)} hint="Inicio, fichas de tours y datos para buscadores." />
        <SwitchField label="Mostrar reseñas en el widget" name="show_on_widget" checked={values.show_on_widget} disabled={!canEdit} onCheckedChange={(checked) => set("show_on_widget", checked)} />
      </Block>

      <Block title="Feed del widget" info="Regenera las reseñas publicadas que muestra el widget en webs de terceros. Respeta «Mostrar reseñas en el widget».">
        <p className="text-[13px] text-fg-2">{settings.values.last_export ? `Última exportación: ${formatDateTime(settings.values.last_export.at)} · ${settings.values.last_export.by} · ${settings.values.last_export.count} reseñas.` : "Aún no se exporta el feed."}</p>
        {canEdit && <ReviewToolbarAction label="Exportar feed ahora" icon={<RefreshCw size={16} />} hint="Vuelve a generar el feed con las reseñas publicadas." run={exportReviewFeed} />}
      </Block>

      <Block title="Filtros de contenido" info="Las palabras de la lista y los datos personales (correo, teléfono, documento) dejan la reseña pendiente con el motivo.">
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-fg">Palabras no permitidas</span>
          <div className="flex flex-wrap gap-2 rounded-control border border-line p-2">
            {values.banned_words.map((item) => (
              <span key={item} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-1.5 text-[13px] text-fg">
                {item}
                {canEdit && (
                  <button type="button" aria-label={`Quitar ${item}`} onClick={() => set("banned_words", values.banned_words.filter((value) => value !== item))} className="grid h-5 w-5 place-items-center rounded-full text-fg-3 hover:bg-line hover:text-fg">
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {canEdit && <input value={word} onChange={(event) => setWord(event.target.value)} onKeyDown={onWordKey} onBlur={addWord} placeholder={values.banned_words.length === 0 ? "Escribe y presiona Enter" : "Agregar"} className="h-8 min-w-[140px] flex-1 bg-transparent px-2 text-[13px] text-fg outline-none placeholder:text-fg-3" />}
          </div>
        </div>
        <ChoiceGroup key={`pd-${settings.lock_version}`} label="Datos personales en el texto" name="personal_data" options={settings.options.personal_data} defaultValue={values.personal_data} onChange={(value) => set("personal_data", value as OwnReviewSettingsValues["personal_data"])} />
      </Block>

      <Block title="Aspectos que califica el viajero">
        <div className="flex flex-wrap gap-2">
          {settings.options.subratings.map((option) => {
            const on = values.active_subratings.includes(option.value);
            return (
              <button key={option.value} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => toggleSubrating(option.value)} className={cn("h-9 rounded-full border px-4 text-[13px] font-semibold transition", on ? "border-transparent bg-brand text-brand-fg" : "border-line text-fg-2 hover:text-fg")}>
                {option.label}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title="Invitación a opinar" info={`Puedes usar ${settings.options.placeholders.join(", ")} en el asunto y el mensaje.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Canal" name="channel" options={settings.options.channels} value={values.invite.channel} onChange={(value) => setInvite("channel", value as OwnReviewSettingsValues["invite"]["channel"])} />
          <TextField label="Recordatorio (días)" type="number" min={0} max={30} value={values.invite.reminder_days} disabled={!canEdit} onChange={(event) => setInvite("reminder_days", Number(event.target.value))} />
          <TextField label="Vence a los (días)" type="number" min={3} max={120} value={values.invite.expire_days} disabled={!canEdit} onChange={(event) => setInvite("expire_days", Number(event.target.value))} />
        </div>
        <TextField label="Asunto" value={values.invite.subject} disabled={!canEdit} onChange={(event) => setInvite("subject", event.target.value)} />
        <TextArea label="Mensaje" rows={4} value={values.invite.body} disabled={!canEdit} onChange={(event) => setInvite("body", event.target.value)} />
      </Block>

      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        {canEdit && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const response = await saveReviewSettings({ ...values }, settings.lock_version);
                setResult({ ok: response.done, message: response.done ? "Guardamos los ajustes." : (response.message ?? "No pudimos guardar.") });
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar ajustes
          </button>
        )}
        {result && <span className={cn("text-[13px]", result.ok ? "text-ok" : "text-bad")}>{result.message}</span>}
        <span className="ml-auto text-[12px] text-fg-3">{settings.updated_at ? `Último cambio: ${formatDateTime(settings.updated_at)}${settings.updated_by ? ` · ${settings.updated_by}` : ""}` : "Con los valores por defecto"}</span>
      </div>
    </div>
  );
}
