import { BedDouble, ClipboardList, History, MapPin, Ticket, TimerReset, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { HeroBand, HeroChip, HeroPanel, ToneScope } from "@/components/ui/Tinted";
import { Timeline } from "@/features/channels/ChannelUi";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { dayDistance, deadlineLabel, PAX_TYPES, scheduleLabel, SERVICE_KINDS, supplierStatus, type SupplierRequestDetail } from "@/lib/supplier-portal";
import { AlternativePanel, ConfirmPanel, RejectPanel } from "./RequestActions";
import { KindIcon, requestTone, SupplierBadge } from "./SupplierUi";

const PROPOSAL_STATUS: Record<string, string> = { pendiente: "En revisión", aceptada: "Aceptada", rechazada: "No aceptada", expirada: "Venció el bloqueo" };

export function SupplierRequestDetailView({ detail }: { detail: SupplierRequestDetail }) {
  const open = detail.state === "por_responder" || detail.state === "alternativa_propuesta";
  const proposal = detail.proposal;
  const deadline = open ? deadlineLabel(detail) : null;
  const tone = requestTone(detail);

  return (
    <div className="flex flex-col gap-5">
      <PortalTitle title={detail.service} subtitle={`${detail.code} · reserva ${detail.reservation}`} back={{ href: "/proveedor/solicitudes", label: "Solicitudes" }} />

      <ToneScope tone={tone}>
        <HeroBand className="mb-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
                <KindIcon kind={detail.kind} size={15} /> {SERVICE_KINDS[detail.kind] ?? detail.kind} · {supplierStatus(detail.state, "request").label}
              </p>
              <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">{detail.holder}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <HeroChip icon={<TimerReset size={14} />}>
                  {formatDate(detail.date)} · {scheduleLabel(detail)}
                </HeroChip>
                <HeroChip icon={<Users size={14} />}>{detail.pax} pasajeros</HeroChip>
                {detail.rooms && <HeroChip icon={<BedDouble size={14} />}>{detail.rooms} habitaciones</HeroChip>}
                {detail.nights && <HeroChip>{detail.nights === 1 ? "1 noche" : `${detail.nights} noches`}</HeroChip>}
              </div>
              {deadline && <p className={cn("mt-4 text-[13.5px] font-semibold", detail.overdue ? "text-white" : "text-white/85")}>{deadline}</p>}
              {open && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConfirmPanel row={detail} contact={detail.contact} />
                  <RejectPanel row={detail} reasons={detail.reasons} today={detail.today} />
                  {detail.state === "por_responder" && <AlternativePanel row={detail} kinds={detail.alternative_kinds} catalog={detail.catalog} today={detail.today} />}
                </div>
              )}
            </div>
            <HeroPanel solid>
              <p className="text-[12.5px] font-semibold text-fg-3">Tarifa neta</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-[var(--tint)]">{formatMoney(detail.net_cost, detail.currency)}</p>
              <p className="mt-1 text-[12.5px] text-fg-2">Sin IGV · vigente a la fecha del servicio</p>
              <div className="mt-4 flex flex-col gap-1.5 text-[13px]">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-fg-3">Estado</span>
                  <SupplierBadge status={detail.state} scope="request" />
                </span>
                {detail.confirmation_code && (
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-fg-3">Código</span>
                    <b className="font-mono">{detail.confirmation_code}</b>
                  </span>
                )}
                <span className="flex items-center justify-between gap-2">
                  <span className="text-fg-3">Fecha</span>
                  <span>{dayDistance(detail.days_to)}</span>
                </span>
              </div>
            </HeroPanel>
          </div>
        </HeroBand>
      </ToneScope>

      {proposal && (
        <SectionCard icon={ClipboardList} title="Su alternativa" aside={PROPOSAL_STATUS[proposal.review_status]}>
          <FieldList
            fields={[
              { label: "Tipo", value: proposal.kind },
              { label: "Fecha propuesta", value: proposal.date ? formatDate(proposal.date) : "La misma" },
              { label: "Servicio", value: proposal.service ? `${proposal.service.name} · ${proposal.service.ref}` : "El mismo" },
              { label: "Tarifa neta", value: proposal.net_cost !== null ? formatMoney(proposal.net_cost, proposal.currency) : "Sin cambio" },
              { label: "Bloqueo hasta", value: proposal.hold_until ? formatDate(proposal.hold_until) : "—" },
              { label: "Detalle", value: <span className="whitespace-normal">{proposal.note}</span> },
              ...(proposal.review_note ? [{ label: "Respuesta", value: <span className="whitespace-normal">{proposal.review_note}</span> }] : []),
            ]}
          />
        </SectionCard>
      )}

      {!open && <p className="rounded-tile border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-2">La solicitud ya fue respondida. Para cualquier cambio comuníquese con Operaciones de la agencia.</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={Users} title="Pasajeros" aside={detail.passengers.length}>
            {detail.passengers.length === 0 ? (
              <EmptyLine>La agencia aún no registra los nombres de los pasajeros.</EmptyLine>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {detail.passengers.map((pax, index) => (
                  <li key={`${pax.name}-${index}`} style={rise(index)} className={cn("lift flex items-center justify-between gap-2 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                    <span className="min-w-0">
                      <b className={cn("block truncate text-[13.5px] font-semibold", pax.placeholder && "text-fg-3")}>{pax.name}</b>
                      <span className="block truncate text-[12px] text-fg-3">
                        {PAX_TYPES[pax.type] ?? pax.type}
                        {pax.nationality ? ` · ${pax.nationality}` : ""}
                        {pax.diet ? ` · ${pax.diet}` : ""}
                      </span>
                    </span>
                    {pax.lead && <Badge tone="t1">Titular</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard icon={History} title="Seguimiento">
            <Timeline items={detail.history.map((item) => ({ key: item.key, title: item.title, meta: `${formatDateTime(item.at)}${item.detail ? ` · ${item.detail}` : ""}`, note: item.note }))} />
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <SectionCard icon={ClipboardList} title="Datos operativos">
            <FieldList
              fields={[
                { label: "Reserva", value: detail.reservation },
                { label: "Hora", value: detail.time ? `${detail.time} h` : "Por confirmar" },
                ...(detail.kind === "alojamiento" ? [] : [{ label: "Punto de recojo", value: <span className="whitespace-normal">{detail.pickup ?? "La agencia lo indicará en el voucher"}</span> }]),
                ...(detail.confirmed_by ? [{ label: "Confirmado por", value: detail.confirmed_by }] : []),
                ...(detail.confirmed_at ? [{ label: "Confirmado el", value: formatDateTime(detail.confirmed_at) }] : []),
                ...(detail.requested_at ? [{ label: "Solicitado el", value: formatDateTime(detail.requested_at) }] : []),
                ...(detail.reject_reason ? [{ label: "Motivo", value: <span className="whitespace-normal">{detail.reject_reason}</span> }] : []),
              ]}
            />
            {detail.alternative_service && (
              <Link href={`/proveedor/solicitudes/${detail.alternative_service.code}`} className="lift mt-3 flex items-center justify-between gap-2 rounded-tile border border-line px-3.5 py-2.5 text-[13px]">
                <span>Alternativa de {detail.alternative_service.code}</span>
                <span className="text-fg-3">{formatDate(detail.alternative_service.date)}</span>
              </Link>
            )}
            {detail.replaced_by && (
              <Link href={`/proveedor/solicitudes/${detail.replaced_by.code}`} className="lift mt-3 flex items-center justify-between gap-2 rounded-tile border border-line px-3.5 py-2.5 text-[13px]">
                <span>Fecha alternativa propuesta · {detail.replaced_by.code}</span>
                <span className="text-fg-3">{formatDate(detail.replaced_by.date)}</span>
              </Link>
            )}
          </SectionCard>
          {detail.rooming && (
            <SectionCard icon={BedDouble} title="Rooming list">
              <FieldList
                fields={[
                  { label: "Check-in", value: formatDate(detail.rooming.check_in) },
                  { label: "Check-out", value: formatDate(detail.rooming.check_out) },
                  { label: "Habitaciones", value: detail.rooming.rooms },
                  { label: "Estado", value: detail.rooming.confirmed_at ? "Confirmada por el hotel" : detail.rooming.acknowledged_at ? "Recibida" : "Por acusar recibo" },
                ]}
              />
            </SectionCard>
          )}
          <SectionCard icon={Ticket} title="Voucher del pasajero">
            {detail.voucher ? (
              <FieldList
                fields={[
                  { label: "Voucher", value: <span className="font-mono">{detail.voucher.code}</span> },
                  { label: "Versión", value: detail.voucher.version },
                  { label: "Estado", value: <SupplierBadge status={detail.voucher.status} scope="voucher" /> },
                  ...(detail.voucher.used_at ? [{ label: "Utilizado", value: formatDateTime(detail.voucher.used_at) }] : []),
                ]}
              />
            ) : (
              <p className="flex items-start gap-2 text-[13px] text-fg-3">
                <MapPin size={15} className="mt-0.5 flex-none" />
                {open ? "La agencia emite el voucher cuando usted confirma el servicio." : "Aún no se emite un voucher para este servicio."}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
