"use client";

import { ArrowRight, CircleCheck, CircleX, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { RowsEditor } from "@/components/ui/RowsEditor";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { AVAILABILITY_LABEL, CHANNEL_INFO, CHECK_STEP, PRODUCT_STATUS, type ProductContentDraft, type ProductPoliciesDraft, type ProductReview } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { PenaltyTiersEditor } from "../PenaltyTiers";
import { ErrorList, Group, type StepProps } from "./fields";

function LineList({ label, name, lines, onChange, placeholder, error }: { label: string; name: string; lines: string[]; onChange: (lines: string[]) => void; placeholder: string; error?: string }) {
  return (
    <TextArea
      label={label}
      name={name}
      rows={6}
      value={lines.join("\n")}
      error={error}
      placeholder={placeholder}
      hint="Una línea por elemento."
      onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.replace(/^\s+/, "")))}
    />
  );
}

const clean = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);

export function ContentStep({ draft, set, options, errors }: StepProps) {
  const content = draft.content;
  const change = (patch: Partial<ProductContentDraft>) => set((current) => ({ content: { ...current.content, ...patch } }));
  const policy = (patch: Partial<ProductPoliciesDraft>) => set((current) => ({ policies: { ...current.policies, ...patch } }));
  const field = (key: string) => errors[key] ?? errors[`content.${key}`];
  const policyError = (key: string) => errors[key] ?? errors[`policies.${key}`];
  const includedNames = draft.components.filter((component) => component.is_included && component.service_id).map((component) => options.services.find((service) => service.id === component.service_id)?.name).filter((name): name is string => Boolean(name));

  return (
    <div className="flex flex-col gap-7">
      <Group title="Descripción">
        <TextArea label="Descripción completa" name="long_description" rows={5} maxLength={6000} value={content.long_description ?? ""} error={field("long_description")} placeholder="Cuenta la experiencia completa: qué se visita, cómo es el día, qué la hace especial." onChange={(event) => change({ long_description: event.target.value })} />
      </Group>
      <Group
        title="Incluye y no incluye"
        hint={
          includedNames.length > 0 && content.inclusions.length === 0 ? (
            <button type="button" onClick={() => change({ inclusions: includedNames })} className="font-semibold text-accent hover:underline">
              Proponer «Incluye» desde los componentes incluidos
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <LineList label="Incluye" name="inclusions" lines={content.inclusions} error={Object.entries(errors).find(([key]) => key.includes("inclusions"))?.[1]} placeholder={"Transporte turístico\nGuía oficial"} onChange={(inclusions) => change({ inclusions })} />
          <LineList label="No incluye" name="exclusions" lines={content.exclusions} error={Object.entries(errors).find(([key]) => key.includes("exclusions"))?.[1]} placeholder={"Propinas\nBebidas"} onChange={(exclusions) => change({ exclusions })} />
        </div>
      </Group>
      <Group title="Requisitos y recomendaciones">
        <ErrorList errors={errors} prefix={["requirements", "content.requirements"]} />
        <RowsEditor
          testId="field:requirements"
          rows={content.requirements}
          onChange={(requirements) => change({ requirements })}
          create={() => ({ category: "Recomendación", text: "" })}
          itemLabel="Requisito"
          addLabel="Agregar requisito"
          reorder={false}
          render={(row, update, index) => (
            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <SelectField label="Categoría" name={`requirements.${index}.category`} value={row.category ?? ""} options={options.requirement_categories.map((value) => ({ value, label: value }))} onChange={(value) => update({ category: value })} />
              <TextField label="Detalle" name={`requirements.${index}.text`} value={row.text} placeholder="Por ejemplo: pasaporte vigente" onChange={(event) => update({ text: event.target.value })} />
            </div>
          )}
        />
      </Group>
      <Group title="Políticas" hint="Cancelación, cambios, no-show y reembolso son obligatorias para activar el producto.">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextArea label="Cancelación" name="cancellation" rows={3} value={draft.policies.cancellation} error={policyError("cancellation")} onChange={(event) => policy({ cancellation: event.target.value })} />
          <TextArea label="Cambios" name="modification" rows={3} value={draft.policies.modification} error={policyError("modification")} onChange={(event) => policy({ modification: event.target.value })} />
          <TextArea label="No presentarse (no-show)" name="no_show" rows={3} value={draft.policies.no_show} error={policyError("no_show")} onChange={(event) => policy({ no_show: event.target.value })} />
          <TextArea label="Reembolsos" name="refund" rows={3} value={draft.policies.refund} error={policyError("refund")} onChange={(event) => policy({ refund: event.target.value })} />
          <TextArea label="Penalidades" name="penalties" rows={3} value={draft.policies.penalties ?? ""} error={policyError("penalties")} placeholder="Opcional" onChange={(event) => policy({ penalties: event.target.value })} />
          <TextArea label="Cambio de fecha" name="date_change" rows={3} value={draft.policies.date_change ?? ""} error={policyError("date_change")} placeholder="Opcional" onChange={(event) => policy({ date_change: event.target.value })} />
        </div>
      </Group>
      <Group title="Tramos de penalidad por cancelación" hint="Cada tramo dice desde cuántos días antes del servicio rige y qué porcentaje del precio se cobra. Con estos tramos se calcula la penalidad al cancelar una reserva.">
        <PenaltyTiersEditor tiers={draft.policies.penalty_tiers} fromText={draft.policies.tiers_from_text} error={Object.entries(errors).find(([key]) => key.includes("penalty_tiers"))?.[1]} onChange={(penalty_tiers) => policy({ penalty_tiers, tiers_from_text: false })} />
      </Group>
      <Group title="Fotos" hint="Enlaces a las imágenes del producto. La marcada con estrella es la portada.">
        <ErrorList errors={errors} prefix={["media", "content.media"]} />
        <RowsEditor
          testId="field:media"
          rows={content.media}
          onChange={(media) => change({ media })}
          create={() => ({ url: "", alt_text: "", is_main: content.media.length === 0 })}
          itemLabel="Imagen"
          addLabel="Agregar imagen"
          max={20}
          render={(row, update, index) => (
            <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
              <TextField label="Enlace de la imagen" name={`media.${index}.url`} type="url" value={row.url} placeholder="https://" onChange={(event) => update({ url: event.target.value })} />
              <TextField label="Descripción" name={`media.${index}.alt_text`} value={row.alt_text} placeholder="Qué se ve en la foto" onChange={(event) => update({ alt_text: event.target.value })} />
              <button
                type="button"
                aria-pressed={row.is_main}
                onClick={() => change({ media: content.media.map((item, position) => ({ ...item, is_main: position === index })) })}
                className={cn("inline-flex h-12 items-center gap-1.5 rounded-control border px-3 text-[13px] font-semibold transition", row.is_main ? "border-t2 bg-t2/15 text-fg" : "border-line text-fg-3 hover:text-fg")}
              >
                <Star size={15} className={row.is_main ? "fill-t2 text-t2" : undefined} />
                Portada
              </button>
            </div>
          )}
        />
      </Group>
      <Group title="Preguntas frecuentes">
        <ErrorList errors={errors} prefix={["faqs", "content.faqs"]} />
        <RowsEditor
          testId="field:faqs"
          rows={content.faqs}
          onChange={(faqs) => change({ faqs })}
          create={() => ({ question: "", answer: "" })}
          itemLabel="Pregunta"
          addLabel="Agregar pregunta"
          max={30}
          render={(row, update, index) => (
            <div className="grid gap-3">
              <TextField label="Pregunta" name={`faqs.${index}.question`} value={row.question} placeholder="¿Incluye almuerzo?" onChange={(event) => update({ question: event.target.value })} />
              <TextArea label="Respuesta" name={`faqs.${index}.answer`} rows={2} value={row.answer} onChange={(event) => update({ answer: event.target.value })} />
            </div>
          )}
        />
      </Group>
      <Group title="Posicionamiento en buscadores">
        <div className="grid gap-3 lg:grid-cols-2">
          <TextField label="Título SEO" name="seo_title" maxLength={160} value={content.seo_title ?? ""} error={field("seo_title")} placeholder={draft.master.name} onChange={(event) => change({ seo_title: event.target.value })} />
          <TextField label="Slug" name="slug" value={content.slug ?? ""} error={field("slug")} placeholder="valle-sagrado-vip" tip="Parte final del enlace en el sitio web. Minúsculas, números y guiones." onChange={(event) => change({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} />
          <TextArea label="Descripción SEO" name="seo_description" rows={2} maxLength={320} value={content.seo_description ?? ""} error={field("seo_description")} placeholder={draft.master.short_description} onChange={(event) => change({ seo_description: event.target.value })} />
          <TextField label="Video" name="video_url" type="url" value={content.video_url ?? ""} error={field("video_url")} placeholder="https://" onChange={(event) => change({ video_url: event.target.value })} />
        </div>
      </Group>
    </div>
  );
}

export function cleanContent(content: ProductContentDraft): ProductContentDraft {
  return {
    ...content,
    inclusions: clean(content.inclusions),
    exclusions: clean(content.exclusions),
    requirements: content.requirements.filter((item) => item.text.trim() !== ""),
    faqs: content.faqs.filter((item) => item.question.trim() !== "" || item.answer.trim() !== ""),
    media: content.media.filter((item) => item.url.trim() !== ""),
  };
}

export function PublishStep({ draft, set, review, creating, onGo }: StepProps & { review: ProductReview | null; creating: boolean; onGo: (step: number) => void }) {
  const toggle = (channel: string, on: boolean) => set({ channels: on ? [...draft.channels, channel] : draft.channels.filter((item) => item !== channel) });
  const summary = review?.summary;
  const checklist = review?.checklist;
  const pct = checklist ? Math.round((checklist.passed / checklist.total) * 100) : 0;
  const rows: [string, ReactNode][] = summary
    ? [
        ["Producto", <b key="name">{summary.name}</b>],
        ["Código / SKU", <span key="code" className="font-mono text-[12.5px]">{summary.code} · {summary.sku}</span>],
        ["Tipo", summary.type],
        ["Categoría", [summary.category, summary.subcategory].filter(Boolean).join(" › ")],
        ["Destino", summary.destination],
        ["Proveedor principal", summary.provider ?? "Sin asignar"],
        ["Componentes", `${summary.components}${summary.components_cost != null ? ` · costo ${formatMoney(summary.components_cost)}` : ""}`],
        ["Itinerario", `${summary.itinerary_days} día(s)`],
        ["Tarifas", summary.rates],
        ["Temporadas", summary.seasons],
        ["Disponibilidad", AVAILABILITY_LABEL[summary.availability] ?? summary.availability],
        ["Estado", <Badge key="status" tone={PRODUCT_STATUS[summary.status].tone}>{creating ? "Borrador" : PRODUCT_STATUS[summary.status].label}</Badge>],
      ]
    : [];

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <Group title="Canales solicitados" hint="Un producto en borrador no es comercializable: los canales se publican de verdad al activarlo (PRD-BR-002).">
        <div className="flex flex-col gap-3">
          {Object.entries(CHANNEL_INFO).map(([channel, info]) => (
            <SwitchField key={channel} name={`channel.${channel}`} label={info.label} hint={info.hint} checked={channel === "erp" || draft.channels.includes(channel)} disabled={channel === "erp"} onCheckedChange={(on) => toggle(channel, on)} />
          ))}
        </div>
      </Group>
      <div className="flex flex-col gap-6">
        <Group title="Resumen">
          {summary ? (
            <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-fg-3">{label}</dt>
                  <dd className="min-w-0 text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13px] text-fg-3">El resumen aparece al completar los pasos anteriores.</p>
          )}
        </Group>
        {checklist && (
          <Group title="Preparación para activación (§42)">
            <div className="flex items-center justify-between text-[13px]">
              <span>
                {checklist.passed} de {checklist.total} validaciones cumplidas
              </span>
              <b>{pct} %</b>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full transition-[width] duration-700", pct === 100 ? "bg-ok" : "bg-t2")} style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {checklist.items.map((item) => {
                const target = item.ok ? undefined : CHECK_STEP[item.key];
                const content = (
                  <>
                    {item.ok ? <CircleCheck size={17} className="mt-0.5 flex-none text-ok" /> : <CircleX size={17} className="mt-0.5 flex-none text-bad" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{item.label}</span>
                      {item.detail && <span className="block text-[12px] text-fg-3">{item.detail}</span>}
                    </span>
                    {target !== undefined && (
                      <span className="inline-flex flex-none items-center gap-1 self-center text-[12px] font-semibold text-accent opacity-0 transition group-hover:opacity-100">
                        Ir al paso {target + 1}
                        <ArrowRight size={13} />
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={item.key}>
                    {target !== undefined ? (
                      <button type="button" data-testid={`check:${item.key}`} onClick={() => onGo(target)} className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-bad/[0.06]">
                        {content}
                      </button>
                    ) : (
                      <div className={cn("flex items-start gap-2.5 rounded-xl px-2.5 py-2", item.ok && "opacity-70")}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-[12px] text-fg-3">El estado se valida al activar: el producto pasa por revisión y aprobación antes (borrador, revisión, aprobado).</p>
          </Group>
        )}
      </div>
    </div>
  );
}
