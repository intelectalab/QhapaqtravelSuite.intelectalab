"use client";

import { Layers, Plus, UserCheck, UserMinus, UserPlus, Users, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { saveCostCenter, savePortalUser, saveTraveler } from "@/app/(portal)/portal/corporativo/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { ROLE_HINTS, ROLE_OPTIONS, type CorporateTraveler, type CostCenter, type PortalUser } from "@/lib/corporate";
import type { StepResult } from "@/lib/server/resource";
import type { Tone } from "@/lib/tone";
import { CorporateStep, CostCenterFields, PortalUserFields, TravelerFields } from "./CorporateForms";
import { CostCenterUsage } from "./CorporatePortal";

const USER_TONE: Record<PortalUser["status"], Tone> = { invitado: "info", activo: "ok", inactivo: "mute" };

const USER_STATUS: Record<PortalUser["status"], string> = { invitado: "Invitado", activo: "Activo", inactivo: "Inactivo" };

type UserAction = (state: StepResult, form: FormData) => Promise<StepResult>;

export interface TeamActions {
  saveUser: UserAction;
  saveCenter: UserAction;
  saveTraveler: UserAction;
}

const PORTAL_ACTIONS: TeamActions = { saveUser: savePortalUser, saveCenter: saveCostCenter, saveTraveler };

function StatusToggle({ user, actions }: { user: PortalUser; actions: TeamActions }) {
  const next = user.status === "inactivo" ? "activo" : "inactivo";
  const label = next === "inactivo" ? "Desactivar" : "Reactivar";
  return (
    <CorporateStep
      id={`estado-${user.id}`}
      label={label}
      title={`${label} a ${user.full_name}`}
      description={next === "inactivo" ? "Deja de entrar al panel corporativo. Puedes reactivarlo cuando quieras." : user.has_login ? "Vuelve a entrar al panel con su rol actual." : "Queda como invitado hasta que acepte la invitación."}
      submitLabel={label}
      action={actions.saveUser}
      trigger={(open) => <RowIcon tone={next === "inactivo" ? "delete" : "neutral"} label={label} icon={next === "inactivo" ? <UserMinus size={15} /> : <UserCheck size={15} />} onClick={open} />}
    >
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="status" value={next} />
      <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">
        {user.full_name} · {user.email} · {user.portal_role_label}
      </p>
    </CorporateStep>
  );
}

export function PortalUsersTable({ users, centers, travelers, actions, extraActions }: { users: PortalUser[]; centers: CostCenter[]; travelers: CorporateTraveler[]; actions: TeamActions; extraActions?: (user: PortalUser) => ReactNode }) {
  const columns: Column<PortalUser>[] = [
    {
      id: "user",
      header: "Usuario",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">{row.full_name}</b>
          <small className="block text-xs text-fg-3">{row.email}</small>
        </span>
      ),
    },
    {
      id: "role",
      header: "Rol",
      cell: (row) => (
        <span className="text-[13px]" title={ROLE_HINTS[row.portal_role]}>
          {row.portal_role_label}
        </span>
      ),
    },
    { id: "center", header: "Centro de costo", cell: (row) => <span className="font-mono text-[12.5px]">{row.cost_center ?? "Todos"}</span> },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={USER_TONE[row.status]}>{USER_STATUS[row.status]}</Badge> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <CorporateStep id={`usuario-${row.id}`} label="Editar" title={`Editar a ${row.full_name}`} description="Cambia su rol o su centro de costo." submitLabel="Guardar" action={actions.saveUser} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
            <PortalUserFields user={row} centers={centers} travelers={travelers} />
          </CorporateStep>
          {extraActions?.(row)}
          <StatusToggle user={row} actions={actions} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<PortalUser>[] = [
    { id: "activo", label: "Activos", tone: "ok", icon: <UserCheck size={19} />, matches: (row) => row.status === "activo" },
    { id: "invitado", label: "Invitados", tone: "info", icon: <UserPlus size={19} />, matches: (row) => row.status === "invitado" },
    { id: "inactivo", label: "Inactivos", tone: "mute", icon: <UserMinus size={19} />, matches: (row) => row.status === "inactivo" },
  ];
  const filters: FilterConfig<PortalUser>[] = [{ id: "role", label: "Rol", options: ROLE_OPTIONS, value: (row) => row.portal_role }];

  return (
    <DataTable
      screen="corporativo-usuarios"
      rows={users}
      columns={columns}
      getKey={(row) => row.id}
      entityLabel="usuarios"
      searchText={(row) => `${row.full_name} ${row.email} ${row.cost_center ?? ""}`}
      searchPlaceholder="Buscar usuario o correo"
      metrics={metrics}
      filters={filters}
      toolbarEnd={
        <CorporateStep id="invitar" label="Invitar usuario" icon={<UserPlus size={15} />} variant="primary" title="Invitar usuario de la empresa" description="Le llega un correo para crear su contraseña y entrar al panel con el rol que elijas." submitLabel="Enviar invitación" action={actions.saveUser}>
          <PortalUserFields centers={centers} travelers={travelers} />
        </CorporateStep>
      }
      emptyTitle="Sin usuarios del panel"
    />
  );
}

export function CostCenterList({ centers, currency, actions }: { centers: CostCenter[]; currency: string; actions: TeamActions }) {
  return (
    <>
      {centers.length === 0 ? (
        <EmptyLine>Crea el primer centro de costo para repartir las compras y controlar el presupuesto.</EmptyLine>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {centers.map((center, index) => (
            <li key={center.id} style={rise(index)} className={cn("lift relative rounded-tile border border-line px-3.5 py-3", !center.active && "opacity-60", RISE)}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <CostCenterUsage center={center} currency={currency} />
                </div>
                <CorporateStep id={`centro-${center.code}`} label="Editar" title={`Editar ${center.code}`} submitLabel="Guardar" action={actions.saveCenter} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
                  <CostCenterFields center={center} currency={currency} />
                </CorporateStep>
              </div>
              <p className="mt-1.5 text-[11.5px] text-fg-3">
                {center.purchases} {center.purchases === 1 ? "compra" : "compras"} · {center.travelers} {center.travelers === 1 ? "viajero" : "viajeros"}
                {center.is_default ? " · por defecto" : ""}
                {!center.active ? " · inactivo" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <CorporateStep id="centro-nuevo" label="Nuevo centro de costo" icon={<Plus size={15} />} size="sm" title="Nuevo centro de costo" description="Al superar el 80 % del presupuesto avisamos al administrador y al aprobador." submitLabel="Crear" action={actions.saveCenter}>
          <CostCenterFields currency={currency} />
        </CorporateStep>
      </div>
    </>
  );
}

export function TravelersTable({ travelers, centers, actions, editAction, toolbarExtra }: { travelers: CorporateTraveler[]; centers: CostCenter[]; actions: TeamActions; editAction?: (traveler: CorporateTraveler) => ReactNode; toolbarExtra?: ReactNode }) {
  const columns: Column<CorporateTraveler>[] = [
    {
      id: "name",
      header: "Viajero",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">{row.full_name}</b>
          <small className="block text-xs text-fg-3">{[row.doc_type && row.doc_number ? `${row.doc_type} ${row.doc_number}` : null, row.employee_code, row.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</small>
        </span>
      ),
    },
    { id: "center", header: "Centro de costo", cell: (row) => <span className="font-mono text-[12.5px]">{row.cost_center ?? "—"}</span> },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={row.active ? "ok" : "mute"}>{row.active ? "Activo" : "Inactivo"}</Badge> },
    ...(editAction ? [{ id: "actions", header: "", align: "right" as const, mobile: "hidden" as const, cell: (row: CorporateTraveler) => <RowActions>{editAction(row)}</RowActions> }] : []),
  ];
  const filters: FilterConfig<CorporateTraveler>[] = [{ id: "center", label: "Centro de costo", options: centers.map((center) => ({ value: center.code, label: center.code })), value: (row) => row.cost_center ?? "" }];
  return (
    <DataTable
      screen="corporativo-viajeros"
      rows={travelers}
      columns={columns}
      getKey={(row) => row.id}
      entityLabel="viajeros"
      searchText={(row) => `${row.full_name} ${row.doc_number ?? ""} ${row.employee_code ?? ""} ${row.email ?? ""}`}
      searchPlaceholder="Buscar viajero o documento"
      filters={filters}
      toolbarEnd={
        <span className="flex flex-wrap gap-2">
          {toolbarExtra}
          <CorporateStep id="viajero-nuevo" label="Nuevo viajero" icon={<Plus size={15} />} title="Nuevo viajero" description="Las fichas de viajero permiten repartir costos y que cada persona vea sus viajes." submitLabel="Registrar" action={actions.saveTraveler}>
            <TravelerFields centers={centers} />
          </CorporateStep>
        </span>
      }
      emptyTitle="Sin viajeros registrados"
    />
  );
}

export function CorporateTeamView({ users, centers, travelers, currency }: { users: PortalUser[]; centers: CostCenter[]; travelers: CorporateTraveler[]; currency: string }) {
  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={Users} title="Usuarios del panel" aside={users.length}>
        <PortalUsersTable users={users} centers={centers} travelers={travelers} actions={PORTAL_ACTIONS} />
      </SectionCard>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard icon={Layers} title="Centros de costo" aside={centers.length}>
          <CostCenterList centers={centers} currency={currency} actions={PORTAL_ACTIONS} />
        </SectionCard>
        <SectionCard icon={UsersRound} title="Viajeros" aside={travelers.length}>
          <TravelersTable travelers={travelers} centers={centers} actions={PORTAL_ACTIONS} />
        </SectionCard>
      </div>
    </div>
  );
}
