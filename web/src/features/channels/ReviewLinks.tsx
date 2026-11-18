"use client";

import { CircleCheck, CircleX, ExternalLink, Link2, Loader2, MailCheck, MousePointerClick, PlugZap, Send, Star } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveReviewLinks, testReviewLink } from "@/app/(backoffice)/canales/resenas/enlaces-actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import type { PostTripInvitationRow, PostTripInvitations, ReviewLinksOverview } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";
import { ChannelBadge } from "./ChannelUi";

const INITIAL: StepResult = { message: null, done: false };

const PLATFORM_TONE: Record<string, Tone> = { google: "t1", tripadvisor: "ok" };

function LinkField({ platform }: { platform: ReviewLinksOverview["platforms"][number] }) {
  const [url, setUrl] = useState(platform.url ?? "");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 rounded-tile border border-line p-3.5">
      <div className="flex items-end gap-2">
        <TextField
          className="min-w-0 flex-1"
          label={`Enlace de reseñas de ${platform.label}`}
          name={platform.platform}
          type="url"
          inputMode="url"
          maxLength={500}
          spellCheck={false}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setResult(null);
          }}
          placeholder={platform.example}
          hint="Déjalo vacío para no mostrar esta plataforma en la invitación."
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={pending ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
          disabled={pending || url.trim() === ""}
          onClick={() => start(async () => setResult(await testReviewLink(platform.platform, url)))}
          className="mb-6"
        >
          Probar
        </Button>
      </div>
      {result && (
        <p className={cn("flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12.5px]", result.ok ? "bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad")}>
          {result.ok ? <CircleCheck size={14} className="mt-0.5 flex-none" /> : <CircleX size={14} className="mt-0.5 flex-none" />}
          {result.message}
        </p>
      )}
    </div>
  );
}

export function ReviewLinksCard({ links, manage }: { links: ReviewLinksOverview; manage: boolean }) {
  return (
    <section className="mb-4 rounded-tile border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <Link2 size={16} className="text-fg-3" />
          Enlaces públicos para la invitación postviaje
          <InfoTip label="Cómo se usan">La invitación lleva primero la reseña propia y debajo «Opina también en Google / en TripAdvisor», solo con los enlaces cargados y para todos los viajeros. El clic pasa por un enlace propio para contarlo; no sabemos si publicaron.</InfoTip>
        </span>
        {manage && (
          <PanelAction<StepResult>
            label="Editar enlaces"
            variant="ghost"
            size="sm"
            formId="review-links"
            title="Enlaces públicos de reseñas"
            description="Copia el enlace de reseñas desde tu perfil de Google o de TripAdvisor. «Probar» revisa el formato y el dominio sin salir a internet."
            submitLabel="Guardar enlaces"
            action={saveReviewLinks}
            initial={INITIAL}
          >
            {() => (
              <div className="grid gap-3">
                <input type="hidden" name="lock_version" value={links.lock_version} />
                {links.platforms.map((platform) => (
                  <LinkField key={platform.platform} platform={platform} />
                ))}
              </div>
            )}
          </PanelAction>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.platforms.map((platform, index) => (
          <article key={platform.platform} style={{ ...toneStyle(platform.url ? PLATFORM_TONE[platform.platform] ?? "t1" : "mute"), animationDelay: `${index * 60}ms` }} className="lift group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--tint)] text-[12px] font-bold text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{platform.label.slice(0, 2)}</span>
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-semibold">{platform.label}</b>
                  <span className="block truncate text-[12px] text-fg-3">{platform.url ?? "Sin enlace: no sale en la invitación"}</span>
                </span>
              </span>
              {platform.url ? (
                <a href={platform.url} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg" aria-label={`Abrir el enlace de ${platform.label}`}>
                  <ExternalLink size={15} />
                </a>
              ) : (
                <Badge tone="mute">Sin cargar</Badge>
              )}
            </div>
            {platform.url && <p className="mt-2 text-[12px] text-fg-2">En la invitación: «{platform.invite}»</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function Clicks({ row }: { row: PostTripInvitationRow }) {
  const items = [
    { key: "own", label: "Propia", value: row.clicks.own, tone: "violet" as Tone },
    { key: "google", label: "Google", value: row.clicks.google, tone: "t1" as Tone },
    { key: "tripadvisor", label: "TripAdvisor", value: row.clicks.tripadvisor, tone: "ok" as Tone },
  ];
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item.key} style={toneStyle(item.value > 0 ? item.tone : "mute")} title={`${item.label}: ${item.value === 1 ? "1 clic" : `${item.value} clics`}`} className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--tint)]">
          {item.label}
          <span className="font-mono">{item.value}</span>
        </span>
      ))}
    </span>
  );
}

export function PostTripInvitationsTable({ data }: { data: PostTripInvitations }) {
  const columns: Column<PostTripInvitationRow>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <Link href={`/reservas/${row.reservation.code}`} className="min-w-0 text-[13px] hover:underline">
          <span className="block truncate font-semibold">{row.reservation.title}</span>
          <span className="block text-xs text-fg-3">
            {row.reservation.code}
            {row.reservation.client ? ` · ${row.reservation.client}` : ""}
          </span>
        </Link>
      ),
    },
    { id: "end", header: "Fin del viaje", cell: (row) => <span className="text-[13px]">{formatDate(row.travel_to)}</span> },
    {
      id: "invitation",
      header: "Invitación",
      cell: (row) =>
        row.invitation ? (
          <span className="grid justify-items-start gap-0.5">
            <ChannelBadge status={row.invitation.status} />
            <span className="text-[11.5px] text-fg-3">{row.invitation.sent_at ? `${formatDateTime(row.invitation.sent_at, false)} · ${row.invitation.channel === "whatsapp" ? "WhatsApp" : "correo"}` : "Programada"}</span>
          </span>
        ) : (
          <span className="text-[12.5px] text-fg-3">Sin invitar</span>
        ),
    },
    { id: "invited", header: "Invitados", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.invited}</span> },
    { id: "clicks", header: "Clic por enlace", cell: (row) => <Clicks row={row} /> },
  ];

  const metrics: MetricFilter<PostTripInvitationRow>[] = [
    { id: "invited", label: "Invitadas", tone: data.rule_active ? "ok" : "mute", icon: <Send size={19} />, note: data.rule_active ? "Invitación postviaje activa" : "Invitación postviaje inactiva", info: <p>Reservas terminadas en los últimos {data.days} días con la invitación a reseñar enviada o programada por la regla R-REVIEW-INVITE de Reglas de reserva. Se invita a todos los pasajeros por igual, sin filtrar por satisfacción. Al presionarla, la tabla muestra esas reservas.</p>, matches: (row) => row.invitation !== null },
    { id: "pending", label: "Sin invitar", tone: "warn", icon: <MailCheck size={19} />, info: <p>Reservas terminadas que todavía no tienen invitación a reseñar. Al presionarla, la tabla muestra esas reservas.</p>, matches: (row) => row.invitation === null },
    { id: "own", label: "Abrieron la propia", tone: "violet", icon: <Star size={19} />, info: <p>Reservas en las que algún pasajero abrió el enlace a la reseña propia de la agencia. Al presionarla, la tabla muestra esas reservas.</p>, matches: (row) => row.clicks.own > 0 },
    { id: "external", label: "Clic en Google o TripAdvisor", tone: "t1", icon: <MousePointerClick size={19} />, info: <p>Reservas en las que algún pasajero pulsó el enlace a Google o TripAdvisor que aparece debajo de la reseña propia. Al presionarla, la tabla muestra esas reservas.</p>, matches: (row) => row.clicks.google + row.clicks.tripadvisor > 0 },
  ];

  const sorts: SortOption<PostTripInvitationRow>[] = [
    { id: "end", label: "Fin del viaje", type: "date", value: (row) => row.travel_to },
    { id: "clicks", label: "Clics externos", type: "number", value: (row) => row.clicks.google + row.clicks.tripadvisor },
  ];

  return (
    <div className="grid gap-4 p-1">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
        <span>Viajes terminados en los últimos {data.days} días.</span>
        <span className="text-fg-3">Debajo de la reseña propia: {data.platforms.filter((platform) => platform.loaded).map((platform) => platform.label).join(" y ") || "ninguna plataforma cargada"}.</span>
      </div>
      <DataTable
        screen="resenas-invitaciones"
        rows={data.rows}
        columns={columns}
        getKey={(row) => row.reservation.code}
        entityLabel="reservas terminadas"
        searchText={(row) => `${row.reservation.code} ${row.reservation.title} ${row.reservation.client ?? ""} ${row.invitation?.code ?? ""}`}
        searchPlaceholder="Buscar reserva o cliente"
        metrics={metrics}
        sorts={sorts}
        emptyTitle="No hay viajes terminados en este periodo"
      />
    </div>
  );
}
