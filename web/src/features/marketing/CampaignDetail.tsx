"use client";

import { BellOff, CheckCheck, MailOpen, MousePointerClick, TriangleAlert, UserX } from "lucide-react";
import { unsubscribeRecipient } from "@/app/(backoffice)/marketing/campanas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { CampaignAudienceDetail, CampaignDetail, CampaignRecipient } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";
import type { Tone } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const RECIPIENT_TONES: Record<CampaignRecipient["status"], Tone> = { pendiente: "mute", enviado: "info", entregado: "ok", rebotado: "warn", fallido: "bad" };

const REASON_TONES: Record<string, string> = { optout: "bg-bad", nodata: "bg-warn", consent: "bg-[var(--violet)]", fatigue: "bg-info" };

function UnsubscribeAction({ code, recipient }: { code: string; recipient: CampaignRecipient }) {
  return (
    <PanelAction<StepResult>
      label="Dar de baja"
      formId={`baja-${recipient.id}`}
      title="Dar de baja al destinatario"
      description={`${recipient.name} deja de recibir comunicaciones comerciales por este canal. Los mensajes de sus reservas siguen llegando.`}
      submitLabel="Registrar baja"
      action={unsubscribeRecipient}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Dar de baja" icon={<BellOff size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="id" value={recipient.id} />
          <p className="rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px]">{recipient.address}</p>
          <p className="text-[12.5px] text-fg-3">La baja queda registrada en el libro de consentimientos con el origen de esta campaña.</p>
        </>
      )}
    </PanelAction>
  );
}

export function CampaignRecipientsTable({ campaign, recipients, truncated }: { campaign: CampaignDetail; recipients: CampaignRecipient[]; truncated: boolean }) {
  const columns: Column<CampaignRecipient>[] = [
    {
      id: "recipient",
      header: "Destinatario",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[13.5px] font-semibold">{row.name}</b>
          <span className="truncate text-[12px] text-fg-3">{row.address}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      mobile: "detail",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={RECIPIENT_TONES[row.status]}>{row.status_label}</Badge>
          {row.unsubscribed_at && <Badge tone="bad" dot={false}>Baja</Badge>}
        </span>
      ),
    },
    { id: "opened", header: "Abrió", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.opened_at ? formatDateTime(row.opened_at, false) : "—"}</span> },
    { id: "clicked", header: "Clic", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.clicked_at ? formatDateTime(row.clicked_at, false) : "—"}</span> },
    {
      id: "actions",
      header: "",
      cell: (row) => (campaign.can.manage && !row.unsubscribed_at ? (
        <RowActions>
          <UnsubscribeAction code={campaign.code} recipient={row} />
        </RowActions>
      ) : null),
    },
  ];
  const metrics: MetricFilter<CampaignRecipient>[] = [
    { id: "delivered", label: "Entregados", tone: "ok", icon: <CheckCheck size={19} />, matches: (row) => row.status === "entregado" },
    { id: "opened", label: "Abrieron", tone: "info", icon: <MailOpen size={19} />, matches: (row) => row.opened_at !== null },
    { id: "clicked", label: "Hicieron clic", tone: "violet", icon: <MousePointerClick size={19} />, matches: (row) => row.clicked_at !== null },
    { id: "failed", label: "Rebotes y fallos", tone: "bad", icon: <TriangleAlert size={19} />, matches: (row) => row.status === "rebotado" || row.status === "fallido" },
    { id: "unsubscribed", label: "Bajas", tone: "warn", icon: <UserX size={19} />, matches: (row) => row.unsubscribed_at !== null },
  ];
  const filters: FilterConfig<CampaignRecipient>[] = [{ id: "status", label: "Estado", options: campaign.recipient_statuses.filter((status) => status.count > 0).map((status) => ({ value: status.value, label: status.label })), value: (row) => row.status }];
  const sorts: SortOption<CampaignRecipient>[] = [
    { id: "name", label: "Nombre", value: (row) => row.name },
    { id: "opened", label: "Apertura", type: "date", value: (row) => row.opened_at },
  ];

  return (
    <div className="flex flex-col gap-3">
      {truncated && <p className="text-[12.5px] text-fg-3">Se muestran los primeros {formatNumber(recipients.length)} destinatarios de {formatNumber(campaign.metrics.recipients)}.</p>}
      <DataTable screen="marketing-campana-destinatarios" rows={recipients} columns={columns} getKey={(row) => row.id} entityLabel="destinatarios" searchText={(row) => `${row.name} ${row.address}`} searchPlaceholder="Buscar nombre o dirección" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="La campaña aún no tiene destinatarios" />
    </div>
  );
}

export function CampaignAudienceView({ audience }: { audience: CampaignAudienceDetail }) {
  const { summary } = audience;
  const max = Math.max(summary.matched, 1);
  const rows = [{ reason: "eligible", label: "Destinatarios elegibles", count: summary.eligible }, ...summary.reasons];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 text-[13px] text-fg-2">
          {audience.snapshot ? "Audiencia congelada al momento del envío" : "Audiencia si se envía ahora"} · {formatNumber(summary.matched)} contactos coinciden con el segmento.
        </p>
        <ul className="flex flex-col gap-2.5">
          {rows.map((row, index) => (
            <li key={row.reason} style={{ animationDelay: `${index * 50}ms` }} className="group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
              <span className="mb-1 flex items-center justify-between text-[12.5px]">
                <span className={row.reason === "eligible" ? "font-semibold" : "text-fg-2"}>{row.reason === "eligible" ? row.label : `Excluidos: ${row.label.toLowerCase()}`}</span>
                <b className="font-mono">{formatNumber(row.count)}</b>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full origin-left rounded-full transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]", row.reason === "eligible" ? "bg-accent" : (REASON_TONES[row.reason] ?? "bg-fg-3"))} style={{ width: `${Math.max((row.count / max) * 100, row.count > 0 ? 2 : 0)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-3 text-[13px] font-semibold">Contactos excluidos</p>
        {audience.suppressed.length === 0 ? (
          <p className="text-[13px] text-fg-3">Nadie quedó fuera de este envío.</p>
        ) : (
          <ul className="scroll-thin flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1">
            {audience.suppressed.map((row) => (
              <li key={`${row.type}:${row.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[12.5px] transition-colors hover:border-accent/40">
                <span className="truncate">{row.name}</span>
                <span className="flex-none text-fg-3">{row.reason_label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CampaignHistory({ history }: { history: CampaignDetail["history"] }) {
  if (history.length === 0) return <p className="text-[13px] text-fg-3">Sin movimientos registrados.</p>;
  return (
    <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
      {history.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
          <p className="text-[13px]">
            <b className="font-semibold capitalize">{entry.action.replace(/_/g, " ")}</b>
            {entry.detail ? <span className="text-fg-2"> · {entry.detail}</span> : null}
          </p>
          <p className="text-[12px] text-fg-3">{entry.by} · {formatDateTime(entry.at)}</p>
        </li>
      ))}
    </ol>
  );
}
