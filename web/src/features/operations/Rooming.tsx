"use client";

import { BedDouble, CircleCheck, Hotel, Pencil, Plus, Send, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROOM_STATUS, type RoomingList, type RoomingOverview, type RoomingRoom } from "@/lib/operations";
import { statusLabel, statusTone, toneStyle } from "@/lib/tone";
import { QuickError, useQuickStep } from "./OrderActions";
import { ConfirmNote, OpsStep, ToggleChips } from "./OpsStep";

export function RoomingPrefillAction({ reservation, legs }: { reservation: string; legs: number }) {
  return (
    <OpsStep
      step="rooming_prefill"
      formKey={`prefill-${reservation}`}
      label="Prellenar rooming desde la reserva web"
      icon={<Wand2 size={15} />}
      size="sm"
      variant="primary"
      title="Prellenar rooming desde la reserva web"
      description={`${reservation} · ${legs === 1 ? "1 ciudad" : `${legs} ciudades`} con alojamiento`}
      submitLabel="Prellenar"
    >
      <input type="hidden" name="reservation" value={reservation} />
      <ConfirmNote>Se crea una rooming list en borrador por ciudad, con las habitaciones que eligió el cliente y numeración provisional. Los adultos se reparten primero, luego los niños; cada infante va con un adulto. Revisa los números de habitación y confírmala antes de enviarla.</ConfirmNote>
    </OpsStep>
  );
}

export function RoomingPrefillNotice({ items, canModify }: { items: RoomingOverview["prefill"]; canModify: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-5 flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.reservation} style={{ ...toneStyle("info"), animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-3.5 py-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[var(--tint)] text-white">
            <Wand2 size={16} />
          </span>
          <span className="min-w-0 flex-1 text-[13px]">
            <b className="block font-semibold">
              Reserva web <Link href={`/reservas/${item.reservation}`} className="hover:underline">{item.reservation}</Link> sin rooming list
            </b>
            <span className="text-fg-2">{item.legs.map((leg) => `${leg.city} · ${leg.hotel} (${leg.rooms} hab.)`).join(" · ")}</span>
          </span>
          {canModify && <RoomingPrefillAction reservation={item.reservation} legs={item.legs.length} />}
        </li>
      ))}
    </ul>
  );
}

export function RoomingCreateAction({ candidates, hotels }: { candidates: RoomingOverview["candidates"]; hotels: RoomingOverview["hotels"] }) {
  const [reservation, setReservation] = useState(candidates[0]?.value ?? "");
  const picked = candidates.find((item) => item.value === reservation);
  return (
    <OpsStep step="rooming_create" label="Nueva rooming list" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title="Nueva rooming list" description="Empieza en borrador. Agrega las habitaciones, confírmala y envíala al hotel." submitLabel="Crear rooming list">
      <SelectField label="Reserva" name="reservation_code" options={candidates} defaultValue={reservation} onChange={setReservation} />
      <SelectField label="Hotel" name="hotel_id" options={hotels} placeholder="Elegir hotel" />
      <div key={reservation} className="grid grid-cols-2 gap-3">
        <TextField label="Ingreso" name="check_in" type="date" required defaultValue={picked?.from ?? ""} />
        <TextField label="Salida" name="check_out" type="date" required defaultValue={picked?.to ?? ""} />
      </div>
    </OpsStep>
  );
}

function RoomForm({ list, room, roomTypes }: { list: RoomingList; room?: RoomingRoom; roomTypes: RoomingOverview["room_types"] }) {
  const placed = new Set(list.rooms.filter((item) => item.id !== room?.id).flatMap((item) => item.guests.map((guest) => guest.id)));
  const options = list.passengers.filter((passenger) => !placed.has(passenger.id)).map((passenger) => ({ value: passenger.id, label: passenger.infant ? `${passenger.name} (infante)` : passenger.name }));
  return (
    <OpsStep
      step="room_save"
      target={room ? `${list.id}/rooms/${room.id}` : `${list.id}/rooms`}
      version={room ? undefined : list.lock_version}
      formKey={room?.id ?? `${list.id}-room`}
      label="Agregar habitación"
      icon={<Plus size={15} />}
      size="sm"
      title={room ? `Habitación ${room.number}` : "Agregar habitación"}
      description={`${list.hotel} · ${list.reservation.code}`}
      submitLabel={room ? "Guardar habitación" : "Agregar habitación"}
      trigger={room ? (open) => <RowIcon tone="edit" label="Editar habitación" icon={<Pencil size={14} />} onClick={open} /> : (open) => <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={open}>Agregar habitación</Button>}
    >
      {room && <input type="hidden" name="room" value={room.id} />}
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
        <TextField label="Número" name="room_number" required maxLength={10} defaultValue={room?.number ?? ""} placeholder="301" />
        <SelectField label="Tipo" name="room_type" options={roomTypes} defaultValue={room?.type ?? "Doble"} />
      </div>
      <ChoiceGroup label="Estado" name="status" options={ROOM_STATUS.map((value) => ({ value, label: statusLabel(value) }))} defaultValue={room?.status ?? "pendiente"} />
      {options.length > 0 ? <ToggleChips label="Huéspedes" name="passenger_ids" options={options} defaultValue={room?.guests.map((guest) => guest.id) ?? []} hint="Los infantes no ocupan cama." /> : <ConfirmNote>Todos los pasajeros ya tienen habitación en esta lista.</ConfirmNote>}
      {["confirmada", "enviada"].includes(list.status) && <ConfirmNote tone="warn">La lista pasará a «Modificada»: tendrás que confirmarla y reenviarla al hotel.</ConfirmNote>}
    </OpsStep>
  );
}

function RoomCard({ list, room, roomTypes, editable, index }: { list: RoomingList; room: RoomingRoom; roomTypes: RoomingOverview["room_types"]; editable: boolean; index: number }) {
  const { run, error } = useQuickStep();
  const adults = room.guests.filter((guest) => !guest.infant).length;
  const full = adults >= room.capacity;
  const over = adults > room.capacity;
  return (
    <li style={{ ...toneStyle(statusTone(room.status)), animationDelay: `${index * 50}ms` }} className="lift group flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-[var(--tint)] font-mono text-[13px] font-bold text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">{room.number}</span>
          <span>
            <b className="block text-[13.5px] font-semibold">{room.type}</b>
            <span className={cn("text-xs", over ? "font-semibold text-bad" : "text-fg-3")}>
              {adults}/{room.capacity}
              {room.guests.length > adults ? ` +${room.guests.length - adults} inf.` : ""} {full && !over ? "· completa" : ""}
            </span>
          </span>
        </span>
        <StatusBadge status={room.status} />
      </div>
      <ul className="mt-3 flex flex-1 flex-col gap-1 text-[13px]">
        {room.guests.length === 0 ? <li className="text-fg-3">Sin huéspedes</li> : room.guests.map((guest) => <li key={guest.id} className="truncate">{guest.name}{guest.infant && <span className="ml-1 text-xs text-fg-3">infante</span>}</li>)}
      </ul>
      {room.note && <p className="mt-2 rounded-lg bg-surface px-2.5 py-2 text-[12px] text-fg-2">{room.note}</p>}
      {editable && (
        <div className="mt-3 flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
          <RoomForm list={list} room={room} roomTypes={roomTypes} />
          <RowIcon tone="delete" label="Eliminar habitación" icon={<Trash2 size={14} />} onClick={() => run({ step: "room_delete", target: `${list.id}/rooms/${room.id}` })} />
        </div>
      )}
      <QuickError message={error} />
    </li>
  );
}

function ListActions({ list }: { list: RoomingList }) {
  const { run, pending, error } = useQuickStep();
  const canSend = ["confirmada", "enviada"].includes(list.status);
  return (
    <div className="flex flex-col items-end">
      <div className="flex flex-wrap justify-end gap-2">
        {list.status !== "enviada" && (
          <OpsStep step="rooming_delete" target={list.id} label="Eliminar" icon={<Trash2 size={15} />} size="sm" variant="ghost" title="Eliminar rooming list" description={`${list.hotel} · ${list.reservation.code}`} submitLabel="Eliminar">
            <ConfirmNote tone="warn">Se eliminan la lista y sus habitaciones. Los pasajeros quedan libres para otra distribución.</ConfirmNote>
          </OpsStep>
        )}
        {list.status !== "confirmada" && list.status !== "enviada" && (
          <Button size="sm" variant="secondary" icon={<CircleCheck size={15} />} disabled={pending} onClick={() => run({ step: "rooming_confirm", target: list.id, lock_version: String(list.lock_version) })}>
            Confirmar
          </Button>
        )}
        <Button size="sm" variant="primary" icon={<Send size={15} />} disabled={pending || !canSend} title={canSend ? undefined : "Confirma la lista antes de enviarla"} onClick={() => run({ step: "rooming_send", target: list.id, lock_version: String(list.lock_version) })}>
          {list.status === "enviada" ? "Reenviar al hotel" : "Enviar al hotel"}
        </Button>
      </div>
      <QuickError message={error} />
    </div>
  );
}

export function RoomingBoard({ data }: { data: RoomingOverview }) {
  const [selected, setSelected] = useState(data.items[0]?.id ?? "");
  const list = data.items.find((item) => item.id === selected) ?? data.items[0];

  if (!list) {
    return (
      <Card>
        <EmptyState icon={<BedDouble size={22} />} title="Aún no hay rooming lists" description="Crea la primera desde una reserva con hotel para distribuir a los pasajeros por habitación." />
      </Card>
    );
  }

  const editable = data.can.modify && list.reservation.status !== "cancelada";
  const placed = list.rooms.reduce((sum, room) => sum + room.guests.length, 0);

  return (
    <>
      <nav aria-label="Rooming lists" className="mb-4 flex flex-wrap gap-2">
        {data.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item.id)}
            style={{ ...toneStyle(statusTone(item.status)), animationDelay: `${index * 50}ms` }}
            className={cn(
              "flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-2 rounded-full border px-3.5 py-2 text-left text-[12.5px] font-semibold transition duration-200 hover:-translate-y-0.5",
              item.id === list.id ? "border-[var(--tint)] bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)]" : "border-line bg-surface text-fg-2 hover:text-fg",
            )}
          >
            <Hotel size={14} />
            {item.reservation.code.replace("RES-", "")} · {item.hotel}
          </button>
        ))}
      </nav>

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[18px] font-bold tracking-tight">
              {list.hotel}
              <StatusBadge status={list.status} />
            </p>
            <p className="text-[13px] text-fg-3">
              <Link href={`/reservas/${list.reservation.code}`} className="hover:text-accent hover:underline">{list.reservation.code}</Link> · {list.reservation.title}
            </p>
            {list.sent_at && <p className="mt-1 text-[12.5px] text-fg-3">Enviada {formatDateTime(list.sent_at, false)}{list.sent_by ? ` por ${list.sent_by}` : ""} · versión {list.sent_version}</p>}
            {list.sent_at && (
              <p className={cn("mt-0.5 text-[12.5px] font-medium", list.hotel_confirmed_at ? "text-ok" : list.hotel_ack_at ? "text-t1" : "text-warn")}>
                {list.hotel_confirmed_at ? `El hotel confirmó las habitaciones el ${formatDateTime(list.hotel_confirmed_at, false)}` : list.hotel_ack_at ? `El hotel acusó recibo el ${formatDateTime(list.hotel_ack_at, false)}` : "El hotel aún no acusa recibo"}
              </p>
            )}
          </div>
          {editable && <ListActions list={list} />}
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
          {[
            { label: "Estadía", value: `${formatDate(list.check_in).replace(/ \d{4}$/, "")} al ${formatDate(list.check_out)}`, note: list.nights === 1 ? "1 noche" : `${list.nights} noches` },
            { label: "Habitaciones confirmadas", value: `${list.rooms.filter((room) => room.status === "confirmada").length} de ${list.rooms.length}`, note: list.rooms.some((room) => room.status === "observada") ? "Con observación del hotel" : "Según el hotel" },
            { label: "Pasajeros ubicados", value: `${placed} de ${list.passengers.length}`, note: placed < list.passengers.length ? "Faltan ubicar" : "Todos con habitación" },
          ].map((fact) => (
            <div key={fact.label} className="rounded-[12px] bg-surface-2 px-3.5 py-2.5">
              <dt className="text-[12px] text-fg-3">{fact.label}</dt>
              <dd className="text-[15px] font-semibold">{fact.value}</dd>
              <dd className="text-[12px] text-fg-3">{fact.note}</dd>
            </div>
          ))}
        </dl>

        {list.warnings.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {list.warnings.map((warning) => (
              <li key={warning.text}>
                <WarningChip tone={warning.level} text={warning.text} />
              </li>
            ))}
          </ul>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Distribución</h3>
          {editable && <RoomForm list={list} roomTypes={data.room_types} />}
        </div>
        {list.rooms.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Agrega la primera habitación para empezar la distribución.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.rooms.map((room, index) => (
              <RoomCard key={room.id} list={list} room={room} roomTypes={data.room_types} editable={editable} index={index} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function WarningChip({ tone, text }: { tone: "bad" | "warn" | "info"; text: string }) {
  return (
    <span style={toneStyle(tone)} className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-3 py-1.5 text-[12.5px] font-medium text-fg transition hover:-translate-y-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint)]" />
      {text}
    </span>
  );
}

