"use client";

import { Building2, MapPin, Pencil, Phone, Plus, Power, PowerOff, Star, Trash2, Users } from "lucide-react";
import { createSede, deleteSede, toggleSede, updateSede, type UserActionState } from "@/app/(backoffice)/admin/usuarios/actions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { TeamSede } from "@/lib/users";

type Manager = { id: string; name: string };

const initial: UserActionState = { message: null, done: false };

function SedeFields({ managers, sede }: { managers: Manager[]; sede?: TeamSede }) {
  return (
    <>
      <TextField label="Nombre" name="name" required defaultValue={sede?.name} placeholder="Puno — Centro" icon={<Building2 size={17} />} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Ciudad" name="city" defaultValue={sede?.city ?? undefined} placeholder="Puno" />
        <TextField label="Teléfono" name="phone" inputMode="tel" defaultValue={sede?.phone ?? undefined} icon={<Phone size={17} />} />
      </div>
      <TextField label="Dirección" name="address" required defaultValue={sede?.address} icon={<MapPin size={17} />} />
      <SelectField label="Responsable (opcional)" name="manager_id" options={managers.map((manager) => ({ value: manager.id, label: manager.name }))} defaultValue={sede?.manager?.id ?? ""} placeholder="Sin responsable" />
    </>
  );
}

export function SedeCreateAction({ managers, disabledReason }: { managers: Manager[]; disabledReason?: string }) {
  return (
    <PanelAction<UserActionState>
      label="Nueva sede"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="sede-create"
      title="Nueva sede"
      description={disabledReason ?? "Las sedes agrupan usuarios, reservas y caja por oficina."}
      submitLabel="Crear sede"
      action={createSede}
      initial={initial}
    >
      {() => <SedeFields managers={managers} />}
    </PanelAction>
  );
}

function SedeCard({ sede, managers, index }: { sede: TeamSede; managers: Manager[]; index: number }) {
  const active = sede.status === "activa";
  const locked = sede.users > 0 || sede.reservations > 0 || sede.is_main;

  return (
    <ToneScope tone={active ? (sede.is_main ? "t1" : "t4") : "mute"}>
      <article style={{ animationDelay: `${index * 70}ms` }} className="lift group flex h-full flex-col overflow-hidden rounded-card border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-surface shadow-card motion-safe:animate-[drop-in_320ms_ease-out_backwards]">
        <header className="relative flex items-start gap-3 overflow-hidden bg-[var(--tint)] px-4 py-3.5 text-white">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:18px_18px] opacity-[0.12] transition-[background-position] duration-700 ease-out group-hover:bg-[position:9px_9px]" />
          <span className="relative grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-white/15 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            {sede.is_main ? <Star size={18} /> : <Building2 size={18} />}
          </span>
          <div className="relative min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-bold">{sede.name}</h3>
            <p className="text-[12px] text-white/75">{[sede.code, sede.city, sede.is_main ? "Principal" : null].filter(Boolean).join(" · ")}</p>
          </div>
          {!active && <Badge tone="mute" className="relative bg-white/90">Inactiva</Badge>}
        </header>
        <div className="flex flex-1 flex-col gap-2.5 p-4 text-[13px]">
          <p className="flex items-start gap-2 text-fg-2">
            <MapPin size={15} className="mt-0.5 flex-none text-[var(--tint)]" />
            {sede.address}
          </p>
          {sede.phone && (
            <p className="flex items-center gap-2 text-fg-2">
              <Phone size={15} className="flex-none text-[var(--tint)]" />
              {sede.phone}
            </p>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <span className="rounded-[11px] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--tint)]">
                <Users size={13} />
                Usuarios
              </span>
              <b className="text-[17px]">{sede.users}</b>
            </span>
            <span className="rounded-[11px] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-3 py-2">
              <span className="text-[11.5px] font-semibold text-[var(--tint)]">Reservas</span>
              <b className="block text-[17px]">{sede.reservations}</b>
            </span>
          </div>
          <p className="text-[12.5px] text-fg-3">Responsable: {sede.manager?.name ?? "sin asignar"}</p>
        </div>
        <footer className="flex flex-wrap justify-end gap-1.5 border-t border-line-2 px-3 py-2.5">
          <PanelAction<UserActionState> label="Editar" icon={<Pencil size={15} />} variant="ghost" size="sm" formId={`sede-edit-${sede.code}`} title="Editar sede" description={`${sede.name} · ${sede.code}`} submitLabel="Guardar cambios" action={updateSede} initial={initial}>
            {() => (
              <>
                <input type="hidden" name="code" value={sede.code} />
                <SedeFields managers={managers} sede={sede} />
              </>
            )}
          </PanelAction>
          {!sede.is_main && (
            <PanelAction<UserActionState>
              label={active ? "Desactivar" : "Activar"}
              icon={active ? <PowerOff size={15} /> : <Power size={15} />}
              variant="ghost"
              size="sm"
              formId={`sede-toggle-${sede.code}`}
              title={active ? "Desactivar sede" : "Activar sede"}
              description={active ? "No se puede desactivar si tiene usuarios activos. Su historial se conserva." : "Volverá a aparecer para asignar usuarios y reservas. Cuenta para el límite de tu plan."}
              submitLabel={active ? "Desactivar" : "Activar"}
              action={toggleSede}
              initial={initial}
            >
              {() => (
                <>
                  <input type="hidden" name="code" value={sede.code} />
                  <input type="hidden" name="mode" value={active ? "deactivate" : "activate"} />
                </>
              )}
            </PanelAction>
          )}
          {!locked && (
            <PanelAction<UserActionState> label="Eliminar" icon={<Trash2 size={15} />} variant="ghost" size="sm" formId={`sede-delete-${sede.code}`} title="Eliminar sede" description={`${sede.name} no tiene usuarios ni reservas, así que se puede eliminar.`} submitLabel="Eliminar sede" action={deleteSede} initial={initial}>
              {() => <input type="hidden" name="code" value={sede.code} />}
            </PanelAction>
          )}
        </footer>
      </article>
    </ToneScope>
  );
}

export function SedesGrid({ sedes, managers }: { sedes: TeamSede[]; managers: Manager[] }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3")}>
      {sedes.map((sede, index) => (
        <SedeCard key={sede.code} sede={sede} managers={managers} index={index} />
      ))}
    </div>
  );
}
