"use client";

import { Ban, Building2, CalendarRange, CircleCheck, CreditCard, Eye, Handshake, Landmark, Lock, LockOpen, Mail, Percent, Plus, RotateCcw, ShieldAlert, TrendingUp, User, Wallet } from "lucide-react";
import { changeAgencyStatus, previewAgencyPortal, saveAgency } from "@/app/(backoffice)/canales/b2b/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import type { B2bAgency, B2bOverview } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ChannelBadge, DetailPanel, PanelSection, TileGrid, UsageBar } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

type Catalogs = Pick<B2bOverview, "price_lists" | "clients">;

export function B2bTiles({ kpis }: { kpis: B2bOverview["kpis"] }) {
  const usage = kpis.credit_limit > 0 ? (kpis.credit_used / kpis.credit_limit) * 100 : 0;
  return (
    <TileGrid className="xl:grid-cols-5">
      <TintTile icon={Handshake} tone="t1" label="Agencias activas" value={`${kpis.active} de ${kpis.total}`} note={kpis.restricted > 0 ? `${kpis.restricted} con restricción` : "Todas habilitadas"} />
      <TintTile icon={Landmark} tone="info" label="Crédito otorgado" value={formatMoney(kpis.credit_limit, kpis.currency)} note={`Disponible ${formatMoney(Math.max(0, kpis.credit_limit - kpis.credit_used), kpis.currency)}`} info={<p>Suma de los límites de crédito de las agencias con convenio. Las de solo prepago no suman.</p>} />
      <TintTile icon={CreditCard} tone="violet" label="Crédito utilizado" value={formatMoney(kpis.credit_used, kpis.currency)} note={`${formatPercent(usage, 0)} de la línea total`} info={<p>Saldo por cobrar de las reservas a crédito de las agencias, frente al crédito otorgado.</p>} />
      <TintTile icon={TrendingUp} tone="t4" label="Ventas B2B" value={formatMoney(kpis.sales, kpis.currency)} note="Reservas vigentes de las agencias" />
      <TintTile icon={Percent} tone="sun" label="Comisiones estimadas" value={formatMoney(kpis.commission, kpis.currency)} note="Según la comisión de cada convenio" />
    </TileGrid>
  );
}

export function AgencyFormAction({ agency, catalogs, iconOnly = false }: { agency?: B2bAgency; catalogs: Catalogs; iconOnly?: boolean }) {
  return (
    <PanelAction<StepResult>
      label={agency ? "Editar" : "Nueva agencia"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={agency ? `agency-${agency.code}` : "agency-new"}
      title={agency ? "Editar agencia" : "Nueva agencia aliada"}
      description={agency ? `${agency.legal_name} · ${agency.code}` : "La agencia queda activa y puede reservar con su lista de precios."}
      submitLabel={agency ? "Guardar cambios" : "Registrar agencia"}
      action={saveAgency}
      initial={initial}
      trigger={iconOnly ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {agency && (
            <>
              <input type="hidden" name="code" value={agency.code} />
              <input type="hidden" name="lock_version" value={agency.lock_version} />
            </>
          )}
          <PanelSection title="Empresa">
            <TextField label="Razón social" name="legal_name" required defaultValue={agency?.legal_name} icon={<Building2 size={17} />} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} pattern="\d{11}" defaultValue={agency?.ruc} />
              <SelectField label="Cliente en CRM" name="client" options={catalogs.clients.map((client) => ({ value: client.code, label: client.name }))} defaultValue={agency?.client?.code} placeholder="Sin vincular" />
            </div>
            <TextField label="Contacto" name="contact_name" required defaultValue={agency?.contact_name} icon={<User size={17} />} />
            <TextField label="Correo de reservas" name="booking_email" type="email" defaultValue={agency?.booking_email ?? undefined} icon={<Mail size={17} />} />
          </PanelSection>
          <PanelSection title="Convenio">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Lista de precios" name="price_list_id" options={catalogs.price_lists.map((list) => ({ value: list.id, label: list.name }))} defaultValue={agency?.price_list.id ?? catalogs.price_lists[0]?.id} />
              <TextField label="Comisión (%)" name="commission_pct" type="number" min={0} max={30} step="0.5" required defaultValue={agency?.commission_pct ?? 10} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Vigente desde" name="valid_from" type="date" required defaultValue={agency?.valid_from} icon={<CalendarRange size={17} />} />
              <TextField label="Vigente hasta" name="valid_to" type="date" required defaultValue={agency?.valid_to} />
            </div>
          </PanelSection>
          <PanelSection title="Línea de crédito">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles (PEN)" }, { value: "USD", label: "Dólares (USD)" }]} defaultValue={agency?.currency ?? "PEN"} />
              <TextField label="Límite" name="credit_limit" type="number" min={0} step="100" defaultValue={agency?.credit_limit ?? 0} icon={<Wallet size={17} />} hint="0 = solo prepago." />
            </div>
          </PanelSection>
        </>
      )}
    </PanelAction>
  );
}

const STATUS_COPY = {
  bloquear: { status: "bloqueada", title: "Bloquear agencia", label: "Bloquear", icon: <Lock size={15} />, tone: "delete" as const, hint: "Solo podrá reservar con prepago hasta que la desbloquees." },
  desbloquear: { status: "activa", title: "Desbloquear agencia", label: "Desbloquear", icon: <LockOpen size={15} />, tone: "neutral" as const, hint: "Vuelve a reservar con su línea de crédito." },
  desactivar: { status: "inactiva", title: "Desactivar agencia", label: "Desactivar", icon: <Ban size={15} />, tone: "delete" as const, hint: "Se conserva con sus reservas y movimientos; ya no puede ingresar al portal." },
  reactivar: { status: "activa", title: "Reactivar agencia", label: "Reactivar", icon: <RotateCcw size={15} />, tone: "neutral" as const, hint: "Recupera su convenio y su acceso al portal." },
};

export function AgencyStatusAction({ agency, target }: { agency: B2bAgency; target: keyof typeof STATUS_COPY }) {
  const copy = STATUS_COPY[target];
  return (
    <PanelAction<StepResult>
      label={copy.label}
      formId={`agency-status-${agency.code}-${target}`}
      title={copy.title}
      description={`${agency.legal_name}. ${copy.hint}`}
      submitLabel={copy.label}
      action={changeAgencyStatus}
      initial={initial}
      trigger={(open) => <RowIcon tone={copy.tone} label={copy.label} icon={copy.icon} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={agency.code} />
          <input type="hidden" name="lock_version" value={agency.lock_version} />
          <input type="hidden" name="status" value={copy.status} />
          <TextArea label={target === "bloquear" ? "Motivo" : "Motivo (opcional)"} name="reason" rows={3} maxLength={200} required={target === "bloquear"} placeholder={target === "bloquear" ? "Por ejemplo: pagos vencidos por más de 30 días." : undefined} />
        </>
      )}
    </PanelAction>
  );
}

function PortalPreviewAction({ agency }: { agency: B2bAgency }) {
  return (
    <PanelAction<StepResult>
      label="Ver portal como esta agencia"
      icon={<Eye size={16} />}
      size="sm"
      formId={`agency-preview-${agency.code}`}
      title="Ver portal como esta agencia"
      description={`Abre el portal de ${agency.legal_name} en modo de solo lectura durante 30 minutos. Queda registrado en la auditoría.`}
      submitLabel="Abrir portal"
      action={previewAgencyPortal}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={agency.code} />
          <p className="text-[13px] text-fg-2">Verás el catálogo, las tarifas, las reservas y el estado de cuenta tal como los ve la agencia. No podrás reservar ni cambiar datos. Para volver, usa «Volver al backoffice» en la barra superior.</p>
        </>
      )}
    </PanelAction>
  );
}

function AgencyDetail({ agency, canPreview }: { agency: B2bAgency; canPreview: boolean }) {
  return (
    <DetailPanel label="Ver agencia" title={agency.legal_name} description={`${agency.code} · RUC ${agency.ruc}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge status={agency.effective_status} />
        {agency.block_reason && <span className="text-[12.5px] text-fg-3">{agency.block_reason === "manual" ? "Bloqueo manual" : "Crédito excedido"}</span>}
      </div>
      <PanelSection title="Convenio">
        <FieldList
          fields={[
            { label: "Contacto", value: agency.contact_name },
            { label: "Correo", value: agency.booking_email ?? "—" },
            { label: "Cliente CRM", value: agency.client ? <a href={`/crm/clientes/${agency.client.code}`} className="font-semibold hover:text-accent">{agency.client.name}</a> : "Sin vincular" },
            { label: "Lista", value: agency.price_list.name },
            { label: "Comisión", value: formatPercent(agency.commission_pct, 0) },
            { label: "Vigencia", value: `${formatDate(agency.valid_from)} – ${formatDate(agency.valid_to)}` },
          ]}
        />
      </PanelSection>
      <PanelSection title="Usuarios del portal" aside={`${agency.portal_users.length}`}>
        {agency.portal_users.length === 0 ? (
          <p className="text-[13px] text-fg-3">Pendiente de alta: invita a un usuario de la agencia desde Administración › Usuarios para que reserve en el portal.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agency.portal_users.map((user) => (
              <li key={user.email} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2.5">
                <span className="min-w-0">
                  <b className="block truncate text-[13.5px] font-semibold">{user.name}</b>
                  <span className="text-[12px] text-fg-3">{user.code ? `${user.code} · ` : ""}{user.email}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <ChannelBadge status={user.status} />
                  <span className="text-[11.5px] text-fg-3">{user.last_login_at ? `Ingresó ${formatDate(user.last_login_at)}` : "Sin ingresos"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {canPreview && agency.portal_users.some((user) => user.status === "activo") && <PortalPreviewAction agency={agency} />}
      </PanelSection>
      <PanelSection title="Línea de crédito" aside={agency.credit_limit > 0 ? formatMoney(agency.credit_limit, agency.currency) : "Solo prepago"}>
        {agency.credit_limit > 0 && (
          <>
            <UsageBar pct={agency.usage_pct ?? 0} />
            <p className="text-[12.5px] text-fg-3">
              Usado {formatMoney(agency.credit_used, agency.currency)} · disponible {formatMoney(agency.credit_available, agency.currency)}
            </p>
          </>
        )}
      </PanelSection>
      <PanelSection title="Tarifas B2B asignadas" aside={`${agency.rates.length}`}>
        {agency.rates.length === 0 ? (
          <p className="text-[13px] text-fg-3">Sin tarifas: la agencia todavía no puede reservar ningún producto. Asígnalas en «Listas de precios».</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agency.rates.map((rate) => (
              <li key={rate.product.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2.5">
                <span className="min-w-0">
                  <a href={`/catalogo/productos/${rate.product.code}?seccion=b2b`} className="block truncate text-[13.5px] font-semibold hover:text-accent">{rate.product.name}</a>
                  <span className="text-[12px] text-fg-3">{rate.price_list ?? "Sin lista"} · comisión {formatPercent(rate.commission_pct, 0)} · {rate.credit_allowed ? "con crédito" : "solo prepago"}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <b className="text-[13px]">{formatMoney(rate.net_price, rate.currency)}</b>
                  {rate.expired ? <ChannelBadge status="vencida" /> : rate.valid_to ? <span className="text-[11.5px] text-fg-3">hasta {formatDate(rate.valid_to)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
      <PanelSection title="Reservas" aside={`${agency.reservations.length}`}>
        {agency.reservations.length === 0 ? (
          <p className="text-[13px] text-fg-3">Todavía no reserva por este canal.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agency.reservations.map((reservation) => (
              <li key={reservation.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2.5">
                <span className="min-w-0">
                  <a href={`/reservas/${reservation.code}`} className="block truncate text-[13.5px] font-semibold hover:text-accent">{reservation.title}</a>
                  <span className="text-[12px] text-fg-3">{reservation.code} · {formatDate(reservation.travel_from)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <b className="text-[13px]">{formatMoney(reservation.total, reservation.currency)}</b>
                  <ChannelBadge status={reservation.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </DetailPanel>
  );
}

export function B2bAgenciesTable({ rows, catalogs, canManage }: { rows: B2bAgency[]; catalogs: Catalogs; canManage: boolean }) {
  const columns: Column<B2bAgency>[] = [
    {
      id: "agency",
      header: "Agencia",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[13.5px] font-semibold">{row.legal_name}</b>
          <span className="text-[12px] text-fg-3">{row.code} · RUC {row.ruc}</span>
        </span>
      ),
    },
    { id: "list", header: "Lista", cell: (row) => <span className="text-[13px]">{row.price_list.name}</span> },
    { id: "commission", header: "Comisión", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatPercent(row.commission_pct, 0)}</span> },
    {
      id: "credit",
      header: "Crédito",
      cell: (row) =>
        row.credit_limit > 0 ? (
          <span className="flex w-40 flex-col gap-1">
            <span className="text-[12.5px]">
              <b className="font-semibold">{formatMoney(row.credit_used, row.currency)}</b> <span className="text-fg-3">de {formatMoney(row.credit_limit, row.currency)}</span>
            </span>
            <UsageBar pct={row.usage_pct ?? 0} />
          </span>
        ) : (
          <span className="text-[12.5px] text-fg-3">Solo prepago</span>
        ),
    },
    {
      id: "available",
      header: "Disponible",
      align: "right",
      cell: (row) => (row.credit_limit > 0 ? <span className={cn("font-mono text-[13px] font-semibold", (row.usage_pct ?? 0) >= 90 ? "text-bad" : "text-fg")}>{formatMoney(row.credit_available, row.currency)}</span> : <span className="text-[12.5px] text-fg-3">—</span>),
    },
    { id: "valid", header: "Vigencia", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">hasta {formatDate(row.valid_to)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.effective_status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          <AgencyDetail agency={row} canPreview={canManage} />
          {canManage && (
            <>
              <AgencyFormAction agency={row} catalogs={catalogs} iconOnly />
              {row.status === "activa" && <AgencyStatusAction agency={row} target="bloquear" />}
              {row.status === "bloqueada" && <AgencyStatusAction agency={row} target="desbloquear" />}
              <AgencyStatusAction agency={row} target={row.status === "inactiva" ? "reactivar" : "desactivar"} />
            </>
          )}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<B2bAgency>[] = [
    { id: "active", label: "Activas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.effective_status === "activa" },
    { id: "restricted", label: "Con restricción", tone: "bad", icon: <ShieldAlert size={19} />, matches: (row) => ["bloqueada", "vencida"].includes(row.effective_status) },
    { id: "credit", label: "Crédito sobre 80 %", tone: "warn", icon: <CreditCard size={19} />, matches: (row) => (row.usage_pct ?? 0) >= 80 },
    { id: "prepaid", label: "Solo prepago", tone: "violet", icon: <Wallet size={19} />, matches: (row) => row.credit_limit === 0 },
  ];
  const filters: FilterConfig<B2bAgency>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.effective_status))].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })), value: (row) => row.effective_status },
    { id: "list", label: "Lista", options: catalogs.price_lists.map((list) => ({ value: list.name, label: list.name })), value: (row) => row.price_list.name },
  ];
  const sorts: SortOption<B2bAgency>[] = [
    { id: "name", label: "Agencia", value: (row) => row.legal_name },
    { id: "usage", label: "Uso de crédito", type: "number", value: (row) => row.usage_pct ?? 0 },
    { id: "sales", label: "Ventas", type: "number", value: (row) => row.sales },
    { id: "valid", label: "Vigencia", type: "date", value: (row) => row.valid_to },
  ];
  return <DataTable screen="canales-b2b" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="agencias" searchText={(row) => `${row.legal_name} ${row.ruc} ${row.contact_name} ${row.code}`} searchPlaceholder="Buscar agencia, RUC o contacto" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin agencias aliadas" />;
}
