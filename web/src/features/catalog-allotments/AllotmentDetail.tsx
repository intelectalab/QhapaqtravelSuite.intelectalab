"use client";

import { ArrowLeftRight, ChevronLeft, ChevronRight, CircleCheck, Hourglass, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldList } from "@/components/ui/Details";
import { PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { ALLOTMENT_STATUS, CONTRACT_STEPS, KIND_LABEL, REQUEST_STATUS, isClosed, type AllotmentCell, type AllotmentDetail, type AllotmentStatus, type AllotmentRequest, type ConsumptionRow } from "@/lib/catalog-allotments";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { CellButton, CellLegend, DayPanel, weekday } from "./AllotmentDay";
import { ExpansionRequestAction, ExpansionRespondActions } from "./AllotmentForms";

const WEEK = 7;

const monday = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function ContractCalendar({ detail }: { detail: AllotmentDetail }) {
  const params = useSearchParams();
  const { contract, today } = detail;
  const focus = params.get("fecha");
  const anchor = focus ?? (today >= contract.valid_from && today <= contract.valid_to ? today : contract.valid_from);
  const [start, setStart] = useState(monday(anchor));
  const byDate = useMemo(() => new Map(detail.days.map((day) => [day.date, day])), [detail.days]);
  const refs = useMemo(() => {
    const map = new Map<string, ConsumptionRow[]>();
    for (const row of detail.consumptions) map.set(row.date, [...(map.get(row.date) ?? []), row]);
    return map;
  }, [detail.consumptions]);
  const [open, setOpen] = useState<AllotmentCell | null>(() => (focus ? (byDate.get(focus) ?? null) : null));
  const dates = Array.from({ length: WEEK * 4 }, (_, index) => addDays(start, index));
  const withRefs = (cell: AllotmentCell): AllotmentCell => ({ ...cell, refs: refs.get(cell.date) ?? [] });

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button size="sm" icon={<ChevronLeft size={15} />} onClick={() => setStart(addDays(start, -WEEK * 4))}>4 semanas</Button>
        <Button size="sm" onClick={() => setStart(monday(today))}>Hoy</Button>
        <Button size="sm" onClick={() => setStart(addDays(start, WEEK * 4))}>
          4 semanas <ChevronRight size={15} />
        </Button>
        <span className="text-[13px] text-fg-3">
          {formatDate(dates[0])} al {formatDate(dates[dates.length - 1])}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {dates.slice(0, WEEK).map((date) => (
          <span key={date} className="text-center text-[11.5px] font-semibold capitalize text-fg-3">{weekday(date)}</span>
        ))}
        {dates.map((date) => {
          const day = byDate.get(date);
          return (
            <div key={date}>
              <span className={cn("mb-0.5 block text-center font-mono text-[10.5px]", date === today ? "font-bold text-accent" : "text-fg-3")}>{date.slice(8, 10)}/{date.slice(5, 7)}</span>
              <CellButton compact cell={day ?? { date, state: "off" }} today={today} onClick={day ? () => setOpen(withRefs(day)) : undefined} />
            </div>
          );
        })}
      </div>
      <CellLegend />
      <DayPanel contract={contract} cell={open} today={today} canManage={detail.can.manage} onClose={() => setOpen(null)} />
    </div>
  );
}

export function ContractConditions({ detail }: { detail: AllotmentDetail }) {
  const { contract } = detail;
  const tile = (step: AllotmentStatus, note: string) => (
    <li key={step} style={toneStyle(ALLOTMENT_STATUS[step].tone)} className={cn("lift flex-1 rounded-xl border px-3 py-2.5 text-[13px]", step === contract.status ? "border-[var(--tint)] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] font-semibold" : "border-line text-fg-3")} aria-current={step === contract.status ? "step" : undefined}>
      {ALLOTMENT_STATUS[step].label}
      <span className="block text-[11.5px] font-normal text-fg-3">{note}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-fg-3">Mientras está vigente</p>
          <ol className="flex items-center gap-2" aria-label="Ciclo del contrato">
            {tile(CONTRACT_STEPS[0], "Cupo disponible para vender")}
            <li aria-hidden className="flex-none text-fg-3">
              <ArrowLeftRight size={16} />
            </li>
            {tile(CONTRACT_STEPS[1], "Se activa y se cierra solo con el release")}
          </ol>
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-fg-3">Salidas</p>
          <ol className="flex items-center gap-2" aria-label="Salidas del contrato">
            {tile(CONTRACT_STEPS[2], "Acción manual")}
            {tile(CONTRACT_STEPS[3], "Al terminar la vigencia")}
          </ol>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSection title="Contrato">
          <FieldList
            fields={[
              { label: "Proveedor", value: <Link href="/catalogo/proveedores" className="font-semibold text-accent hover:underline">{contract.provider.name}</Link> },
              { label: "Contacto", value: contract.provider_contact ?? "—" },
              { label: "Servicio", value: contract.service.name },
              { label: "Tipo", value: `${KIND_LABEL[contract.kind]} · ${contract.unit}` },
              { label: "Vigencia", value: `${formatDate(contract.valid_from)} – ${formatDate(contract.valid_to)}` },
              { label: "Bloqueo base", value: `${contract.base_qty} por fecha` },
              { label: "Responsable", value: contract.owner ?? "—" },
              { label: "Registrado", value: formatDateTime(contract.created_at) },
            ]}
          />
        </PanelSection>
        <PanelSection title="Condiciones económicas y release">
          <FieldList
            fields={[
              { label: "Tarifa neta", value: `${formatMoney(contract.net_rate, contract.currency)} por ${contract.unit}` },
              { label: "Release", value: `${contract.release_days} días antes del servicio` },
              { label: "Penalidad", value: contract.penalty_pct ? `${contract.penalty_pct} % de lo retenido sin usar` : "Sin penalidad económica" },
              { label: "Pago", value: contract.payment_terms ?? "—" },
              { label: "Referencia", value: contract.contract_ref ?? "—" },
              ...(contract.release_reason ? [{ label: "Liberado", value: contract.release_reason }] : []),
            ]}
          />
          {contract.notes && <p className="whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{contract.notes}</p>}
        </PanelSection>
      </div>
      {detail.special.length > 0 && (
        <PanelSection title="Fechas con bloqueo distinto al base">
          <ul className="flex flex-wrap gap-1.5">
            {detail.special.map((day) => (
              <li key={day.date} className="lift rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[12px]">
                {day.date.slice(8, 10)}/{day.date.slice(5, 7)} · <b>{day.blocked}</b>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </div>
  );
}

export function ContractConsumption({ detail }: { detail: AllotmentDetail }) {
  const columns: Column<ConsumptionRow>[] = [
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{weekday(row.date)} {formatDate(row.date)}</span> },
    { id: "reservation", header: "Reserva", mobile: "title", cell: (row) => <Link href={`/reservas/${row.reservation}`} className="font-semibold text-accent hover:underline">{row.reservation}</Link> },
    { id: "service", header: "Servicio", cell: (row) => <span className="text-[13px]">{row.service}</span> },
    { id: "qty", header: "Unidades", align: "right", cell: (row) => <b className="font-mono text-[13.5px]">{row.qty}</b> },
    { id: "state", header: "Consumo", cell: (row) => <Badge tone={row.state === "consumido" ? "ok" : "sun"}>{row.state === "consumido" ? "Consume cupo" : "En trámite"}</Badge> },
  ];
  const metrics: MetricFilter<ConsumptionRow>[] = [
    { id: "used", label: "Consumen cupo", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.state === "consumido" },
    { id: "pending", label: "En trámite", tone: "sun", icon: <Hourglass size={19} />, matches: (row) => row.state === "en_tramite" },
  ];
  return (
    <div className="p-5">
      <DataTable screen="cupo-consumo" rows={detail.consumptions} columns={columns} getKey={(row) => `${row.date}-${row.reservation}-${row.service}`} entityLabel="consumos" searchText={(row) => `${row.reservation} ${row.service}`} searchPlaceholder="Buscar reserva o servicio" metrics={metrics} emptyTitle="Ninguna reserva consume este contrato" />
    </div>
  );
}

export function ContractRequests({ detail }: { detail: AllotmentDetail }) {
  const { contract } = detail;
  const manage = detail.can.manage && !isClosed(contract.status);
  const columns: Column<AllotmentRequest>[] = [
    { id: "code", header: "Solicitud", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block font-mono text-[13px] font-semibold">{row.code}</b><small className="block text-xs text-fg-3">{formatDateTime(row.requested_at, false)}{row.requested_by ? ` · ${row.requested_by}` : ""}</small></span> },
    { id: "range", header: "Fechas", cell: (row) => <span className="text-[13px]">{formatDate(row.date_from)} – {formatDate(row.date_to)}</span> },
    { id: "extra", header: "Adicional", align: "right", cell: (row) => <b className="font-mono text-[13.5px]">+{row.extra_qty}</b> },
    { id: "note", header: "Motivo", wideOnly: true, cell: (row) => <span className="block max-w-[260px] truncate text-[13px] text-fg-2" title={row.note}>{row.note}</span> },
    { id: "status", header: "Estado", cell: (row) => <span><Badge tone={REQUEST_STATUS[row.status].tone}>{REQUEST_STATUS[row.status].label}</Badge>{row.response && <small className="mt-1 block max-w-[220px] truncate text-xs text-fg-3" title={row.response}>{row.response}</small>}</span> },
    ...(manage
      ? [
          {
            id: "actions",
            header: "",
            mobile: "hidden" as const,
            align: "right" as const,
            cell: (row: AllotmentRequest) => <RowActions>{row.status === "solicitada" ? <ExpansionRespondActions contract={contract} request={row} /> : null}</RowActions>,
          },
        ]
      : []),
  ];
  const metrics: MetricFilter<AllotmentRequest>[] = [
    { id: "solicitada", label: "Por responder", tone: "sun", icon: <Send size={19} />, matches: (row) => row.status === "solicitada" },
    { id: "aceptada", label: "Aceptadas", tone: "ok", icon: <ThumbsUp size={19} />, matches: (row) => row.status === "aceptada" },
    { id: "rechazada", label: "Rechazadas", tone: "bad", icon: <ThumbsDown size={19} />, matches: (row) => row.status === "rechazada" },
  ];
  return (
    <div className="p-5">
      <DataTable
        screen="cupo-ampliaciones"
        rows={detail.requests}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="solicitudes"
        searchText={(row) => `${row.code} ${row.note} ${row.response ?? ""}`}
        searchPlaceholder="Buscar solicitud"
        metrics={metrics}
        toolbarEnd={manage ? <ExpansionRequestAction contract={contract} today={detail.today} /> : undefined}
        emptyTitle="Sin solicitudes de ampliación"
      />
    </div>
  );
}
