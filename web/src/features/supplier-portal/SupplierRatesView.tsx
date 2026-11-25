"use client";

import { ArrowDownRight, ArrowUpRight, CalendarRange, Hourglass, PackageCheck, Pencil, Send, Tags, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveRateRequest, withdrawRateRequest } from "@/app/(proveedor)/proveedor/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { DateField } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { PortalTitle, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { supplierStatus, type SupplierRateRequest, type SupplierRateService, type SupplierRates } from "@/lib/supplier-portal";
import { SupplierBadge } from "./SupplierUi";

function RatePanel({ data, service, request }: { data: SupplierRates; service: SupplierRateService; request?: SupplierRateRequest }) {
  const router = useRouter();
  const editing = Boolean(request);
  return (
    <PanelAction<StepResult>
      label={editing ? "Editar solicitud" : "Solicitar cambio"}
      formId={`tarifa-${request?.code ?? service.ref}`}
      trigger={(open) => (editing ? <RowIcon tone="edit" label="Editar solicitud" onClick={open} /> : <RowIcon tone="neutral" label="Solicitar cambio de tarifa" icon={<Send size={15} />} onClick={open} />)}
      title={editing ? `Editar ${request?.code}` : "Solicitar cambio de tarifa"}
      description={`${service.name} · vigente ${formatMoney(service.cost, service.currency)} por ${service.unit}. La agencia la revisa y, si la aprueba, crea una nueva vigencia; las reservas confirmadas conservan la tarifa pactada.`}
      submitLabel={editing ? "Guardar cambios" : "Enviar solicitud"}
      action={saveRateRequest.bind(null, request?.code ?? null)}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ service: service.ref }} />
          <TextField label={`Nueva tarifa neta (${service.currency}, sin IGV)`} name="proposed_cost" type="number" step="0.01" min="0.01" required defaultValue={request?.proposed ?? ""} icon={<Tags size={17} />} />
          <DateField label="Rige desde" name="effective_from" min={data.earliest} required defaultValue={request?.effective_from ?? data.earliest} hint={`Con al menos ${data.notice_days} días de anticipación, según tu contrato.`} />
          <SelectField label="Motivo" name="reason_type" placeholder="Elige el motivo" defaultValue={request?.reason_type ?? ""} options={data.reasons.map((value) => ({ value, label: value }))} />
          <TextArea label="Sustento" name="reason_detail" rows={4} maxLength={1000} defaultValue={request?.reason_detail ?? ""} placeholder="Explique qué cambia y por qué." />
        </>
      )}
    </PanelAction>
  );
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return <span className="text-[12px] text-fg-3">sin cambio</span>;
  const up = pct > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12.5px] font-semibold", up ? "text-warn" : "text-ok")}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? "+" : ""}
      {pct.toFixed(1)} %
    </span>
  );
}

export function SupplierRatesView({ data }: { data: SupplierRates }) {
  const byRef = new Map(data.services.map((service) => [service.ref, service]));
  const pending = data.requests.filter((row) => row.status === "pendiente");
  const expiring = data.services.filter((service) => service.status === "activo").filter((service) => service.valid_to < data.earliest);

  const serviceColumns: Column<SupplierRateService>[] = [
    {
      id: "service",
      header: "Servicio",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <b className="block max-w-[360px] truncate font-semibold">{row.name}</b>
          <span className="text-[12px] text-fg-3">
            {row.ref} · {row.type}
            {row.capacity ? ` · capacidad ${row.capacity}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "cost",
      header: "Tarifa neta",
      align: "right",
      cell: (row) => (
        <span className="block text-right leading-tight">
          <b className="block text-[14px]">{formatMoney(row.cost, row.currency)}</b>
          <span className="text-[12px] text-fg-3">por {row.unit}</span>
        </span>
      ),
    },
    {
      id: "validity",
      header: "Vigencia",
      cell: (row) => (
        <span className="text-[12.5px] text-fg-2">
          {formatDate(row.valid_from)} – {formatDate(row.valid_to)}
        </span>
      ),
    },
    {
      id: "update",
      header: "Actualización",
      mobile: "detail",
      cell: (row) =>
        row.pending ? (
          <span className="flex flex-col items-start gap-0.5">
            <SupplierBadge status="pendiente" scope="rate" />
            <span className="text-[12px] text-fg-3">
              {formatMoney(row.pending.proposed, row.currency)} desde {formatDate(row.pending.from)}
            </span>
          </span>
        ) : row.scheduled_cost !== null && row.scheduled_from ? (
          <span className="text-[12.5px] text-fg-2">
            {formatMoney(row.scheduled_cost, row.currency)} desde {formatDate(row.scheduled_from)}
          </span>
        ) : (
          <span className="text-[12.5px] text-fg-3">Sin cambios programados</span>
        ),
    },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "ok" : row.status === "vencido" ? "bad" : "mute"}>{capitalize(row.status)}</Badge> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => <RowActions>{row.status === "activo" && !row.pending ? <RatePanel data={data} service={row} /> : <RowIcon tone="neutral" label="Solicitar cambio" icon={<Send size={15} />} disabledHint={row.pending ? "Actualización enviada; espere la respuesta de la agencia" : "Solo servicios activos"} />}</RowActions>,
    },
  ];

  const requestColumns: Column<SupplierRateRequest>[] = [
    {
      id: "code",
      header: "Solicitud",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <b className="block truncate font-semibold">{row.service}</b>
          <span className="text-[12px] text-fg-3">
            {row.code} · {formatDateTime(row.requested_at)}
          </span>
        </span>
      ),
    },
    {
      id: "change",
      header: "Cambio",
      align: "right",
      cell: (row) => (
        <span className="block text-right leading-tight">
          <span className="block text-[12.5px] text-fg-3 line-through">{formatMoney(row.current, row.currency)}</span>
          <b className="block text-[13.5px]">{formatMoney(row.proposed, row.currency)}</b>
          <Change pct={row.change_pct} />
        </span>
      ),
    },
    { id: "from", header: "Rige desde", cell: (row) => <span className="text-[13px]">{formatDate(row.effective_from)}</span> },
    {
      id: "reason",
      header: "Motivo",
      mobile: "detail",
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
          {row.reason_type}
          {row.reason_detail && <InfoTip label="Ver sustento">{row.reason_detail}</InfoTip>}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <SupplierBadge status={row.status} scope="rate" />
          {row.review_note && <span className="max-w-[220px] truncate text-[12px] text-fg-3" title={row.review_note}>{row.review_note}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => {
        const service = byRef.get(row.service_ref);
        if (row.status !== "pendiente" || !service) return null;
        return (
          <RowActions>
            <RatePanel data={data} service={service} request={row} />
            <ConfirmAction id={row.code} label="Retirar solicitud" title={`Retirar ${row.code}`} description="La agencia deja de revisarla y la tarifa vigente no cambia. Puedes enviar una nueva cuando quieras." submitLabel="Retirar" icon={<Undo2 size={15} />} action={withdrawRateRequest.bind(null, row.code)} hidden={{}} />
          </RowActions>
        );
      },
    },
  ];

  const metrics: MetricFilter<SupplierRateRequest>[] = [
    { id: "pending", label: "En revisión", icon: <Hourglass size={19} />, tone: "violet", note: pending.length ? "La agencia te responderá" : "Ninguno pendiente", info: <p>Solicitudes de cambio de tarifa que la agencia todavía revisa.</p>, matches: (row) => row.status === "pendiente" },
    { id: "approved", label: "Aprobadas", icon: <PackageCheck size={19} />, tone: "ok", info: <p>Solicitudes que la agencia aprobó; crean una nueva vigencia desde la fecha pedida.</p>, matches: (row) => row.status === "aprobada" },
    { id: "closed", label: "Rechazadas o retiradas", icon: <Undo2 size={19} />, tone: "mute", info: <p>Solicitudes que la agencia rechazó o que tú retiraste; la tarifa vigente no cambió.</p>, matches: (row) => row.status === "rechazada" || row.status === "retirada" },
  ];
  const serviceMetrics: MetricFilter<SupplierRateService>[] = [
    { id: "active", label: "Servicios activos", icon: <Tags size={19} />, tone: "t1", note: `${data.services.length} en tu contrato`, info: <p>Servicios tuyos que la agencia tiene activos con una tarifa vigente.</p>, matches: (row) => row.status === "activo" },
    { id: "bookings", label: "Reservas con tus servicios", icon: <PackageCheck size={19} />, tone: "ok", display: data.services.reduce((sum, service) => sum + service.bookings, 0), note: "Conservan la tarifa pactada", info: <p>Reservas de la agencia que incluyen tus servicios; un cambio de tarifa no las afecta.</p>, matches: (row) => row.bookings > 0 },
    { id: "expiring", label: "Vigencias por vencer", icon: <CalendarRange size={19} />, tone: expiring.length ? "warn" : "t3", note: `Antes del ${formatDate(data.earliest)}`, info: <p>Servicios activos cuya tarifa vence antes de la fecha más temprana en que podrías pedir un cambio, según el aviso de tu contrato.</p>, matches: (row) => row.status === "activo" && row.valid_to < data.earliest },
  ];
  const filters: FilterConfig<SupplierRateRequest>[] = [{ id: "status", label: "Estado", options: [...new Set(data.requests.map((row) => row.status))].map((value) => ({ value, label: supplierStatus(value, "rate").label })), value: (row) => row.status }];
  const sorts: SortOption<SupplierRateRequest>[] = [
    { id: "requested", label: "Fecha de solicitud", type: "date", value: (row) => row.requested_at },
    { id: "from", label: "Rige desde", type: "date", value: (row) => row.effective_from },
    { id: "change", label: "Variación", type: "number", value: (row) => row.change_pct },
  ];

  return (
    <>
      <PortalTitle title="Tarifas" subtitle="Tus tarifas netas contratadas con la agencia, sin IGV. Los cambios se solicitan y la agencia los aprueba." />
      <div className="flex flex-col gap-6">
        <DataTable screen="proveedor-tarifas" rows={data.services} columns={serviceColumns} getKey={(row) => row.ref} entityLabel="servicios" searchText={(row) => `${row.ref} ${row.name} ${row.type}`} searchPlaceholder="Buscar servicio" metrics={serviceMetrics} emptyTitle="La agencia aún no registra servicios suyos" />

        <SectionCard icon={Pencil} title="Solicitudes de actualización" aside={data.requests.length}>
          <DataTable screen="proveedor-solicitudes-tarifa" rows={data.requests} columns={requestColumns} getKey={(row) => row.code} entityLabel="solicitudes" metrics={metrics} filters={filters} sorts={sorts} searchText={(row) => `${row.code} ${row.service} ${row.reason_type}`} searchPlaceholder="Buscar solicitud" emptyTitle="Aún no envía solicitudes" />
        </SectionCard>
      </div>
    </>
  );
}
