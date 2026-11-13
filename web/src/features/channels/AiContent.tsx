"use client";

import { Award, Ban, Check, CircleCheck, Coins, ImageIcon, ImagePlus, ListChecks, RefreshCw, Sparkles, TextCursorInput, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import { startTransition, useActionState, useMemo, useState, useTransition } from "react";
import { aiJobAction, createAiImages, createAiJob, purchaseAiPack, updateAiImage } from "@/app/(backoffice)/canales/contenido-ia/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { AI_STATUS_TONE, type AiCreditsSummary, type AiImage, type AiJob, type AiKind, type AiLedgerRow, type AiOptions, type AiPack, type AiPacksOverview } from "@/lib/siteTemplates";
import { TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

const credits = (value: number) => `${formatNumber(value)} ${value === 1 ? "crédito" : "créditos"}`;

const money = (pack: Pick<AiPack, "price" | "currency">) => `${pack.currency === "PEN" ? "S/" : pack.currency} ${Number(pack.price).toLocaleString("es-PE", { maximumFractionDigits: 2 })}`;

export function AiCreditTiles({ summary, jobs }: { summary: AiCreditsSummary; jobs: AiJob[] }) {
  const content = summary.balances.contenido;
  const images = summary.balances.imagenes;

  return (
    <TileGrid>
      <TintTile icon={Sparkles} tone={content.low ? "sun" : "t1"} label="Créditos de contenido" value={formatNumber(content.balance)} note={`${summary.plan_included.contenido} del plan al mes${summary.ai_plan ? ` + ${formatNumber(summary.ai_plan.credits)} de ${summary.ai_plan.name}` : ""}`} info="Saldo del libro de créditos de su agencia: asignaciones y compras menos lo que consumieron los pedidos listos. Un pedido fallido no descuenta." />
      <TintTile icon={ImageIcon} tone={images.low ? "sun" : "violet"} label="Créditos de imágenes" value={formatNumber(images.balance)} note={`${summary.costs.imagen} por imagen estándar · ${summary.costs.imagen_hd} por HD`} info="Saldo de créditos de imágenes en el libro de créditos. Se compran por paquete o vienen con IA Pro." />
      <TintTile icon={ListChecks} tone="t4" label="Pedidos" value={jobs.length} note={`${jobs.filter((job) => job.status === "listo").length} por revisar · ${jobs.filter((job) => job.status === "aplicado").length} aplicados`} info="Pedidos de texto e imágenes registrados por su equipo. Ninguno se publica sin que una persona lo aplique." />
      <TintTile icon={Award} tone="ok" label="Plan de IA" value={summary.ai_plan?.name ?? "Solo su plan"} note={summary.ai_plan ? `${money(summary.ai_plan)} al mes` : "Sin plan adicional"} info="El último plan de IA contratado según el libro de créditos." />
    </TileGrid>
  );
}

function BeforeAfter({ job }: { job: AiJob }) {
  const render = (value: AiJob["before"]) =>
    value ? (
      value.title !== undefined ? (
        <>
          <p className="text-[13.5px] font-semibold">{value.title || "Sin título"}</p>
          <p className="mt-1 text-[13px] text-fg-3">{value.desc || "Sin descripción"}</p>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-[13.5px]">{value.text || "Sin texto"}</p>
      )
    ) : (
      <p className="text-[13px] text-fg-3">—</p>
    );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-[12px] border border-line p-3">
        <h4 className="mb-1.5 text-[12px] font-semibold text-fg-3">Antes</h4>
        {render(job.before)}
      </div>
      <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] p-3">
        <h4 className="mb-1.5 text-[12px] font-semibold text-[var(--accent)]">Propuesta de la IA</h4>
        {render(job.after)}
      </div>
    </div>
  );
}

function JobActions({ job }: { job: AiJob }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (action: "apply" | "discard" | "regenerate") =>
    start(async () => {
      const result = await aiJobAction(job.code, action);
      setMessage(result.done ? null : result.message);
    });

  return (
    <div className="mt-3 flex flex-col gap-2">
      <FormError message={message} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} disabled={pending} onClick={() => run("discard")}>
          Descartar
        </Button>
        <Button size="sm" icon={<RefreshCw size={15} />} disabled={pending} onClick={() => run("regenerate")}>
          Otra versión ({credits(job.cost)})
        </Button>
        <Button size="sm" variant="primary" icon={<Check size={15} />} disabled={pending} onClick={() => run("apply")}>
          {pending ? "Un momento…" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}

export function ReviewQueue({ jobs }: { jobs: AiJob[] }) {
  const pending = jobs.filter((job) => job.status === "listo" && job.kind !== "imagen");
  const failed = jobs.filter((job) => job.status === "fallido").slice(0, 2);

  return (
    <div className="flex flex-col gap-4">
      {failed.map((job) => (
        <div key={job.code} className="flex items-start gap-2.5 rounded-[12px] bg-bad/[0.08] px-3.5 py-3 text-[13px] text-bad">
          <TriangleAlert size={16} className="mt-0.5 flex-none" />
          <span>
            <b className="font-semibold">{job.code}</b> · {job.kind_label} sobre {job.target_label}: {job.error}
          </span>
        </div>
      ))}
      {pending.length === 0 ? (
        <EmptyState icon={<Sparkles size={20} />} title="Nada por revisar" description="Elija qué mejorar y pulse Generar. Verá el antes y el después para aplicar o descartar." />
      ) : (
        pending.map((job) => (
          <article key={job.code} className="lift rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold">
                {job.kind_label} · {job.target_label}
              </p>
              <span className="font-mono text-[12px] text-fg-3">
                {job.code} · {credits(job.credits_used)}
              </span>
            </div>
            <BeforeAfter job={job} />
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
              <TriangleAlert size={13} />
              {job.warning ?? "Revise cifras, horarios y precios antes de aplicar."}
            </p>
            <JobActions job={job} />
          </article>
        ))
      )}
    </div>
  );
}

export function AiJobForm({ options, costs, balance }: { options: AiOptions; costs: Record<string, number>; balance: number }) {
  const kinds = (Object.keys(options.kind_targets) as Exclude<AiKind, "imagen">[]).map((kind) => ({ value: kind, label: `${options.kinds[kind]} · ${credits(costs[kind] ?? 0)}` }));
  const [kind, setKind] = useState<Exclude<AiKind, "imagen">>("mejorar_texto");
  const [state, run, pending] = useActionState(createAiJob, initial);
  const targets = useMemo(
    () =>
      options.kind_targets[kind].flatMap((type) =>
        type === "libre" ? [{ value: "libre:", label: "Tema libre (artículo nuevo)" }] : options.targets[type].map((target) => ({ value: `${type}:${target.id}`, label: type === "pagina" ? `Página · ${target.label}` : type === "historia" ? `Historia · ${target.label}` : target.label })),
      ),
    [kind, options],
  );
  const cost = costs[kind] ?? 0;
  const locales = Object.entries(options.locales).filter(([value]) => kind !== "traducir" || value !== "es");

  return (
    <Card>
      <CardHeader title="Nuevo pedido" subtitle="La IA usa los datos reales del tour (itinerario, incluye y punto de encuentro) y no inventa cifras." />
      <form
        key={kind}
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(() => run(form));
        }}
      >
        <FormError message={state.message} />
        <SelectField label="Qué necesita" name="kind" options={kinds} value={kind} onChange={(value) => setKind(value as Exclude<AiKind, "imagen">)} />
        {targets.length === 0 ? (
          <p className="rounded-[12px] bg-surface-2 px-3.5 py-3 text-[13px] text-fg-3">{kind === "relato_aventura" ? "Aún no hay historias con el consentimiento del viajero." : "No hay contenidos disponibles para este pedido."}</p>
        ) : (
          <SelectField label="Sobre" name="target" options={targets} defaultValue={targets[0]?.value} searchable={targets.length > 8} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tono" name="tone" options={Object.entries(options.tones).map(([value, label]) => ({ value, label }))} defaultValue="cercano" />
          <SelectField label="Idioma" name="locale" options={locales.map(([value, label]) => ({ value, label }))} defaultValue={locales[0]?.[0]} />
        </div>
        <TextArea label={kind === "articulo" ? "Tema del artículo" : "Indicaciones (opcional)"} name="notes" rows={3} maxLength={1000} placeholder={kind === "articulo" ? "Por ejemplo: qué llevar a la laguna Humantay" : "Por ejemplo: mencionar que el recojo es desde el hotel"} />
        <p className="flex items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--sun)_14%,transparent)] px-3 py-2 text-[13px]">
          <Coins size={16} />
          Costo: <b>{kind === "traducir" ? `${credits(cost)} por cada 1 000 palabras` : credits(cost)}</b> · saldo {formatNumber(balance)} → {formatNumber(Math.max(0, balance - cost))}
        </p>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon={<Wand2 size={16} />} disabled={pending || targets.length === 0}>
            {pending ? "Generando…" : "Generar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AiPicture({ image, className }: { image: AiImage; className?: string }) {
  return <div role="img" aria-label={image.alt_text} className={cn("aspect-[5/3] w-full bg-surface-2 bg-cover bg-center", className)} style={{ backgroundImage: `url(/canales/contenido-ia/imagen/${image.id})` }} />;
}

function ImageAction({ image, mode, uses }: { image: AiImage; mode: "usar" | "alt"; uses: string[] }) {
  return (
    <PanelAction<StepResult>
      label={mode === "usar" ? "Usar" : "Texto alt."}
      icon={mode === "usar" ? <CircleCheck size={14} /> : <TextCursorInput size={14} />}
      variant={mode === "usar" ? "primary" : "secondary"}
      size="sm"
      formId={`image-${mode}-${image.id}`}
      title={mode === "usar" ? "Usar imagen" : "Texto alternativo"}
      description="El texto alternativo describe lo que se ve para lectores de pantalla y buscadores. En el sitio la imagen lleva la etiqueta «Imagen generada con IA»."
      submitLabel={mode === "usar" ? "Usar" : "Guardar"}
      action={updateAiImage}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={image.id} />
          {mode === "usar" && <input type="hidden" name="action" value="usar" />}
          <AiPicture image={image} className="mb-4 rounded-[12px]" />
          {mode === "usar" && <SelectField label="Dónde" name="used_in" options={uses.map((use) => ({ value: use, label: use }))} defaultValue={uses[0]} />}
          <TextField label="Texto alternativo" name="alt_text" required minLength={5} maxLength={200} defaultValue={image.alt_text} className="mt-3" />
        </>
      )}
    </PanelAction>
  );
}

function DiscardImage({ image }: { image: AiImage }) {
  return (
    <PanelAction<StepResult> label="Descartar" icon={<Ban size={14} />} variant="ghost" size="sm" formId={`image-discard-${image.id}`} title="Descartar imagen" description="La imagen queda en la galería como descartada y no se puede usar en el sitio." submitLabel="Descartar" action={updateAiImage} initial={initial}>
      {() => (
        <>
          <input type="hidden" name="id" value={image.id} />
          <input type="hidden" name="action" value="descartar" />
        </>
      )}
    </PanelAction>
  );
}

export function AiImagesView({ images, options, costs, balance }: { images: AiImage[]; options: AiOptions; costs: Record<string, number>; balance: number }) {
  const [count, setCount] = useState(String(options.image_counts[1] ?? 1));
  const [quality, setQuality] = useState("std");
  const [state, run, pending] = useActionState(createAiImages, initial);
  const cost = Number(count) * (quality === "hd" ? costs.imagen_hd : costs.imagen);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <CardHeader title="Crear imágenes" subtitle="Para fotos reales de sus tours, use su propio material: convierte mejor." />
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(() => run(form));
          }}
        >
          <FormError message={state.message} />
          <TextArea label="Describa la imagen" name="prompt" rows={3} required minLength={10} maxLength={2000} placeholder="Por ejemplo: cañón del Colca al amanecer con cóndores volando, luz dorada" />
          <SelectField label="Estilo" name="style" options={Object.entries(options.styles).map(([value, label]) => ({ value, label }))} defaultValue="fotografico" />
          <ChoiceGroup label="Cantidad" name="count" options={options.image_counts.map((value) => ({ value: String(value), label: String(value) }))} defaultValue={count} onChange={setCount} />
          <ChoiceGroup label="Calidad" name="quality" options={Object.entries(options.qualities).map(([value, px]) => ({ value, label: value === "hd" ? `HD · ${px} px` : `Estándar · ${px} px` }))} defaultValue="std" onChange={setQuality} />
          <p className="flex items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--sun)_14%,transparent)] px-3 py-2 text-[13px]">
            <Coins size={16} />
            Costo: <b>{credits(cost)} de imágenes</b> · saldo {balance} → {Math.max(0, balance - cost)}
          </p>
          <p className="text-[12px] text-fg-3">No se generan personas reales identificables, logotipos de terceros ni fotos que se hagan pasar por otro lugar.</p>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon={<ImagePlus size={16} />} disabled={pending}>
              {pending ? "Creando…" : "Crear"}
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Galería" subtitle={`${balance} créditos de imágenes disponibles`} />
        {images.length === 0 ? (
          <EmptyState icon={<ImageIcon size={20} />} title="Aún no hay imágenes" description="Las imágenes que cree aparecerán aquí para revisarlas antes de usarlas." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {images.map((image) => (
              <figure key={image.id} className={cn("lift group overflow-hidden rounded-[12px] border border-line bg-surface", image.status === "descartada" && "opacity-60")}>
                <div className="relative">
                  <AiPicture image={image} className="transition-transform duration-500 group-hover:scale-105" />
                  <small className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">IA{image.hd ? " · HD" : ""}</small>
                </div>
                <figcaption className="flex flex-col gap-2 p-2.5">
                  <p className="line-clamp-2 text-[12.5px]">{image.alt_text}</p>
                  <div className="flex items-center justify-between">
                    <Badge tone={image.status === "en_uso" ? "ok" : image.status === "descartada" ? "mute" : "info"}>{image.status === "en_uso" ? "En uso" : image.status === "descartada" ? "Descartada" : "Generada"}</Badge>
                    <span className="text-[11.5px] text-fg-3">{credits(image.credits_used)}</span>
                  </div>
                  {image.status === "generada" ? (
                    <div className="flex flex-wrap gap-1.5">
                      <ImageAction image={image} mode="usar" uses={options.image_uses} />
                      <ImageAction image={image} mode="alt" uses={options.image_uses} />
                      <DiscardImage image={image} />
                    </div>
                  ) : image.used_in.length > 0 ? (
                    <p className="text-[11.5px] text-fg-3">En: {image.used_in.join(", ")}</p>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function AiHistory({ jobs, options }: { jobs: AiJob[]; options: AiOptions }) {
  const columns: Column<AiJob>[] = [
    {
      id: "code",
      header: "Pedido",
      mobile: "title",
      cell: (job) => (
        <span>
          <b className="block font-mono text-[13px] font-semibold">{job.code}</b>
          <small className="text-xs text-fg-3">{formatDateTime(job.created_at)}</small>
        </span>
      ),
    },
    { id: "kind", header: "Tipo", cell: (job) => <span className="text-[13px]">{job.kind_label}</span> },
    { id: "target", header: "Sobre", cell: (job) => <span className="text-[13px]">{job.target_label}</span> },
    { id: "user", header: "Usuario", wideOnly: true, cell: (job) => <span className="text-[13px]">{job.created_by ?? "—"}</span> },
    { id: "credits", header: "Créditos", align: "right", cell: (job) => <span className="font-mono text-[13px]">{job.credits_used}</span> },
    { id: "status", header: "Estado", cell: (job) => <Badge tone={AI_STATUS_TONE[job.status]}>{job.status_label}</Badge> },
  ];
  const metrics: MetricFilter<AiJob>[] = [
    { id: "listo", label: "Por revisar", tone: "sun", icon: <Sparkles size={19} />, matches: (job) => job.status === "listo" },
    { id: "aplicado", label: "Aplicados", tone: "ok", icon: <CircleCheck size={19} />, matches: (job) => job.status === "aplicado" },
    { id: "descartado", label: "Descartados", tone: "mute", icon: <Ban size={19} />, matches: (job) => job.status === "descartado" },
    { id: "fallido", label: "Fallidos sin cobro", tone: "bad", icon: <TriangleAlert size={19} />, matches: (job) => job.status === "fallido" },
  ];
  const filters: FilterConfig<AiJob>[] = [{ id: "kind", label: "Tipo", options: Object.entries(options.kinds).map(([value, label]) => ({ value, label })), value: (job) => job.kind }];
  const sorts: SortOption<AiJob>[] = [
    { id: "created", label: "Fecha", type: "date", value: (job) => job.created_at },
    { id: "credits", label: "Créditos", type: "number", value: (job) => job.credits_used },
  ];

  return <DataTable screen="contenido-ia-historial" rows={jobs} columns={columns} getKey={(job) => job.code} entityLabel="pedidos" searchText={(job) => `${job.code} ${job.target_label} ${job.created_by ?? ""}`} searchPlaceholder="Buscar pedido" metrics={metrics} filters={filters} sorts={sorts} />;
}

function PackAction({ pack, contracted }: { pack: AiPack; contracted: boolean }) {
  if (contracted) return <Badge tone="ok">Contratado</Badge>;

  return (
    <PanelAction<StepResult>
      label={pack.is_plan ? "Contratar" : "Comprar"}
      icon={<Coins size={14} />}
      variant="primary"
      size="sm"
      formId={`pack-${pack.code}`}
      title={`${pack.is_plan ? "Contratar" : "Comprar"} ${pack.name}`}
      description="Se cobra en su próxima factura de KipuControl. Los créditos se suman al momento."
      submitLabel={`${pack.is_plan ? "Contratar" : "Comprar"} por ${money(pack)}`}
      action={purchaseAiPack}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={pack.code} />
          <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[13.5px]">
            <dt className="text-fg-3">Precio</dt>
            <dd className="font-semibold">
              {money(pack)} + IGV {pack.billing === "mensual" ? "al mes" : "· pago único"}
            </dd>
            <dt className="text-fg-3">Créditos</dt>
            <dd>
              {formatNumber(pack.credits)} de {pack.kind_label.toLowerCase()}
              {pack.image_bonus > 0 ? ` y ${pack.image_bonus} de imágenes` : ""}
              {pack.billing === "mensual" ? " cada mes" : ""}
            </dd>
            <dt className="text-fg-3">Vigencia</dt>
            <dd>{pack.billing === "mensual" ? "Los créditos del mes no se acumulan." : "Vencen a los 12 meses de la compra."}</dd>
          </dl>
        </>
      )}
    </PanelAction>
  );
}

export function AiPlans({ packs, ledger }: { packs: AiPacksOverview; ledger: AiLedgerRow[] }) {
  const columns: Column<AiLedgerRow>[] = [
    { id: "date", header: "Fecha", mobile: "title", cell: (row) => <span className="text-[13px]">{formatDateTime(row.occurred_at)}</span> },
    { id: "kind", header: "Tipo", cell: (row) => <span className="text-[13px]">{row.kind_label}</span> },
    { id: "movement", header: "Movimiento", cell: (row) => <span className="text-[13px]">{row.movement_label}</span> },
    { id: "credits", header: "Créditos", align: "right", cell: (row) => <span className={cn("font-mono text-[13px] font-semibold", row.credits < 0 ? "text-bad" : "text-ok")}>{row.credits > 0 ? `+${row.credits}` : row.credits}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.balance_after}</span> },
    { id: "note", header: "Detalle", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-3">{row.note ?? row.job ?? "—"}</span> },
  ];
  const metrics: MetricFilter<AiLedgerRow>[] = [
    { id: "in", label: "Entradas", tone: "ok", icon: <Coins size={19} />, matches: (row) => row.credits > 0 },
    { id: "out", label: "Consumos y vencimientos", tone: "bad", icon: <Sparkles size={19} />, matches: (row) => row.credits < 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="lift rounded-card border border-line bg-surface p-4 shadow-card">
          <p className="text-[14px] font-semibold">Incluido en su plan</p>
          <p className="mt-1.5 text-[24px] font-bold tracking-tight">{formatNumber(packs.plan_included.contenido)}</p>
          <p className="text-[12.5px] text-fg-3">créditos de contenido al mes, sin costo adicional</p>
        </article>
        {packs.plans.map((plan) => (
          <article key={plan.code} className={cn("lift flex flex-col gap-2 rounded-card border bg-surface p-4 shadow-card", packs.contracted === plan.code ? "border-ok" : "border-line")}>
            <p className="text-[14px] font-semibold">{plan.name}</p>
            <p className="text-[24px] font-bold tracking-tight">
              {money(plan)} <span className="text-[13px] font-normal text-fg-3">al mes</span>
            </p>
            <p className="text-[12.5px] text-fg-3">
              {formatNumber(plan.credits)} créditos de contenido{plan.image_bonus > 0 ? ` y ${plan.image_bonus} imágenes` : ""} al mes
            </p>
            <div className="mt-auto">
              <PackAction pack={plan} contracted={packs.contracted === plan.code} />
            </div>
          </article>
        ))}
      </div>
      <Card>
        <CardHeader title="Paquetes de créditos" subtitle="Precios referenciales sin IGV. Se cobran en su factura de KipuControl." />
        {packs.packs.length === 0 ? (
          <EmptyState icon={<Coins size={20} />} title="Sin paquetes a la venta" description="KipuControl todavía no publicó paquetes de créditos." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {packs.packs.map((pack) => (
              <li key={pack.code} className="lift flex flex-col gap-2 rounded-[12px] border border-line p-3.5">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                  {pack.kind === "imagenes" ? <ImageIcon size={16} className="text-[var(--violet)]" /> : <Sparkles size={16} className="text-[var(--t1)]" />}
                  {pack.name}
                </span>
                <span className="text-[20px] font-bold">{money(pack)}</span>
                <span className="text-[12px] text-fg-3">{pack.billing === "unico" ? "Pago único · vence a 12 meses" : "Mensual"}</span>
                <div className="mt-auto">
                  <PackAction pack={pack} contracted={false} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div>
        <h3 className="mb-2 text-[15px] font-semibold">Movimientos de créditos</h3>
        <DataTable screen="contenido-ia-creditos" rows={ledger} columns={columns} getKey={(row) => row.id} entityLabel="movimientos" searchText={(row) => `${row.note ?? ""} ${row.job ?? ""} ${row.pack ?? ""}`} searchPlaceholder="Buscar movimiento" metrics={metrics} />
      </div>
    </div>
  );
}
