"use client";

import { AlertTriangle, BedDouble, CalendarCheck2, CheckCheck, FileCheck2, Hotel, MessageSquareWarning, PencilLine, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acknowledgeRooming, confirmRooming, observeRoom } from "@/app/(proveedor)/proveedor/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TintTile, ToneScope } from "@/components/ui/Tinted";
import { ConfirmAction, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { EmptyLine, PortalTitle, RISE, rise } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { dayDistance, PAX_TYPES, supplierStatus, type SupplierRooming, type SupplierRoomingList, type SupplierRoomingRoom } from "@/lib/supplier-portal";
import { toneStyle } from "@/lib/tone";
import { SupplierBadge } from "./SupplierUi";

const IMPACT_LABEL: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };

function ObservePanel({ list, room, reasons, impacts }: { list: SupplierRoomingList; room: SupplierRoomingRoom; reasons: string[]; impacts: string[] }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Reportar observación"
      formId={`observar-${room.id}`}
      trigger={(open) => (
        <Button size="sm" variant="ghost" icon={<MessageSquareWarning size={14} />} onClick={open} className="mt-2 self-start">
          Reportar observación
        </Button>
      )}
      title={`Observación de la habitación ${room.number}`}
      description={`${list.reservation} · ${formatDate(list.check_in)} al ${formatDate(list.check_out)}. Se crea una incidencia para Operaciones de la agencia.`}
      submitLabel="Reportar a Operaciones"
      action={observeRoom.bind(null, room.id)}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <SelectField label="Motivo" name="reason" placeholder="Elija el motivo" options={reasons.map((value) => ({ value, label: value }))} />
          <ChoiceGroup label="Impacto" name="impact" defaultValue="media" options={impacts.map((value) => ({ value, label: IMPACT_LABEL[value] ?? value }))} />
          <TextArea label="Propuesta del hotel" name="proposal" rows={3} required minLength={5} maxLength={1000} placeholder="Upgrade a junior suite sin costo adicional." />
        </>
      )}
    </PanelAction>
  );
}

function RoomTile({ list, room, reasons, impacts, index, canAct }: { list: SupplierRoomingList; room: SupplierRoomingRoom; reasons: string[]; impacts: string[]; index: number; canAct: boolean }) {
  const meta = supplierStatus(room.status, "room");
  const adults = room.guests.filter((guest) => guest.type !== "INF").length;
  const infants = room.guests.length - adults;
  return (
    <li style={{ ...toneStyle(meta.tone), ...rise(index) }} className={cn("lift flex flex-col rounded-tile border bg-surface p-3", RISE, room.status === "observada" ? "border-[color-mix(in_srgb,var(--tint)_45%,transparent)]" : "border-line")}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <b className="block text-[14px] font-semibold">Hab. {room.number}</b>
          <span className="text-[12px] text-fg-3">
            {room.type} · {adults}/{room.capacity}
            {infants ? ` +${infants} INF` : ""}
          </span>
        </span>
        <SupplierBadge status={room.status} scope="room" />
      </span>
      <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px]">
        {room.guests.length === 0 ? (
          <li className="text-fg-3">Sin huéspedes asignados</li>
        ) : (
          room.guests.map((guest) => (
            <li key={guest.name} className="flex items-center gap-1.5 text-fg-2">
              <UserRound size={12} className="flex-none text-fg-3" />
              <span className="truncate">{guest.name}</span>
              {guest.type !== "ADT" && <span className="text-[11px] text-fg-3">{PAX_TYPES[guest.type] ?? guest.type}</span>}
            </li>
          ))
        )}
      </ul>
      {room.note && <p className="mt-2 rounded-lg bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-2.5 py-1.5 text-[12px] text-fg-2">{room.note}</p>}
      {room.incident && (
        <Link href={`/proveedor/incidencias/${room.incident.code}`} className="mt-1.5 text-[12px] font-semibold text-[var(--tint)] hover:underline">
          Incidencia {room.incident.code} · {supplierStatus(room.incident.status, "incident").label}
        </Link>
      )}
      {canAct && room.status !== "observada" && <ObservePanel list={list} room={room} reasons={reasons} impacts={impacts} />}
    </li>
  );
}

function arrivalLabel(list: SupplierRoomingList): string | null {
  if (list.in_house) return "En casa";
  if (list.days_to >= 0 && list.days_to <= 7) return `Llega ${dayDistance(list.days_to).toLowerCase()}`;
  return null;
}

function RoomingCard({ list, data, index }: { list: SupplierRoomingList; data: SupplierRooming; index: number }) {
  const meta = supplierStatus(list.state, "rooming");
  const arrival = arrivalLabel(list);
  const pendingRooms = list.rooms.length - list.observed;
  const facts = [
    { label: "Ingreso", value: formatDate(list.check_in) },
    { label: "Salida", value: formatDate(list.check_out) },
    { label: "Noches", value: list.nights },
    { label: "Habitaciones", value: list.rooms.length },
    { label: "Huéspedes", value: list.guests },
  ];
  return (
    <ToneScope tone={meta.tone}>
      <div className={RISE} style={rise(index)}>
      <Card className="relative overflow-hidden">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--tint)]" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[12.5px] text-fg-3">{list.reservation}</p>
            <h2 className="text-[17px] font-bold tracking-tight">{list.holder}</h2>
          </div>
          <span className="flex items-center gap-2">
            {arrival && <span className="rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] px-2.5 py-1 text-[12px] font-semibold text-[var(--tint)]">{arrival}</span>}
            <SupplierBadge status={list.state} scope="rooming" />
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-[10px] bg-surface-2 px-3 py-2">
              <dt className="text-[11.5px] text-fg-3">{fact.label}</dt>
              <dd className="text-[13.5px] font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {list.modified && (
          <p className="mt-3 flex items-center gap-2 rounded-tile bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-3 py-2 text-[12.5px] text-warn">
            <PencilLine size={14} /> La agencia está modificando esta lista. Podrá responder cuando la reenvíe.
          </p>
        )}
        {list.observed > 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-tile bg-[color-mix(in_srgb,var(--bad)_9%,var(--surface))] px-3 py-2 text-[12.5px] text-bad">
            <AlertTriangle size={14} /> {list.observed === 1 ? "Una habitación tiene observación" : `${list.observed} habitaciones tienen observación`}. Operaciones gestiona el cambio.
          </p>
        )}
        {list.rooms.length === 0 ? (
          <EmptyLine>La agencia aún no cargó habitaciones en esta lista.</EmptyLine>
        ) : (
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {list.rooms.map((room, roomIndex) => (
              <RoomTile key={room.id} list={list} room={room} reasons={data.reasons} impacts={data.impacts} index={roomIndex} canAct={!list.modified && !list.confirmed_at} />
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line-2 pt-3 text-[12.5px] text-fg-3">
          <span className="mr-auto">
            Enviada {list.sent_at ? formatDateTime(list.sent_at) : "—"}
            {list.sent_version > 1 ? ` · versión ${list.sent_version}` : ""}
          </span>
          {list.acknowledged_at ? (
            <span className="flex items-center gap-1">
              <FileCheck2 size={14} /> Recibida {formatDateTime(list.acknowledged_at)}
            </span>
          ) : (
            !list.modified && (
              <ConfirmAction id={`acuse-${list.id}`} button label="Acusar recibo" icon={<FileCheck2 size={15} />} title="Acusar recibo" description={`La agencia sabrá que su hotel recibió la rooming list de ${list.reservation}.`} submitLabel="Acusar recibo" action={acknowledgeRooming.bind(null, list.id)} hidden={{ lock_version: list.lock_version }} />
            )
          )}
          {list.confirmed_at ? (
            <span className="flex items-center gap-1 text-ok">
              <CheckCheck size={14} /> Confirmada {formatDateTime(list.confirmed_at)}
            </span>
          ) : (
            !list.modified &&
            list.rooms.length > 0 && (
              <ConfirmAction
                id={`confirmar-${list.id}`}
                button
                label="Confirmar habitaciones"
                icon={<CheckCheck size={15} />}
                title="Confirmar habitaciones"
                description={list.observed ? `Se confirman ${pendingRooms} de ${list.rooms.length} habitaciones. Las observadas quedan pendientes hasta que Operaciones resuelva la incidencia.` : `Se confirman las ${list.rooms.length} habitaciones de ${list.reservation}.`}
                submitLabel="Confirmar"
                action={confirmRooming.bind(null, list.id)}
                hidden={{ lock_version: list.lock_version }}
              />
            )
          )}
        </div>
      </Card>
      </div>
    </ToneScope>
  );
}

export function SupplierRoomingView({ data }: { data: SupplierRooming }) {
  return (
    <>
      <PortalTitle title="Rooming lists" subtitle="Distribución de huéspedes que la agencia envió a su hotel. Acuse recibo, confirme las habitaciones o reporte una observación." />
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <TintTile icon={CalendarCheck2} tone="t1" label="Llegan en 7 días" value={data.kpis.arrivals_week} note="Huéspedes con ingreso esta semana" info="Suma de huéspedes de las listas cuyo ingreso es hoy o en los próximos 7 días." />
        <TintTile icon={Hotel} tone="t3" label="En casa hoy" value={data.kpis.in_house} note="Huéspedes alojados" info="Huéspedes de listas con ingreso hasta hoy y salida posterior a hoy." />
        <TintTile icon={BedDouble} tone={data.kpis.observed ? "bad" : "ok"} label="Habitaciones observadas" value={data.kpis.observed} note={data.kpis.observed ? "En gestión con Operaciones" : "Ninguna"} info="Habitaciones que su hotel observó y siguen pendientes de resolver por la agencia." />
      </section>
      {data.items.length === 0 ? (
        <Card>
          <EmptyLine>La agencia aún no le envió rooming lists.</EmptyLine>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {data.items.map((list, index) => (
            <RoomingCard key={list.id} list={list} data={data} index={index} />
          ))}
        </div>
      )}
    </>
  );
}
