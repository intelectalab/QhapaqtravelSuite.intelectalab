import { BadgePercent, Building2, CalendarRange, CreditCard, History, ListChecks, Mail, Phone, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TintTile } from "@/components/ui/Tinted";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { conventionStatus, MOVEMENT_TYPES, type AgencyProfile } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { CreditMeter } from "./AgencyUi";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[13px] last:border-b-0">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export function AgencyProfileView({ profile }: { profile: AgencyProfile }) {
  const agency = profile.agency;
  const status = conventionStatus(agency.status);
  return (
    <>
      <PortalTitle title="Mi agencia" subtitle="Datos del convenio, tu línea de crédito y los usuarios con acceso al portal." actions={<Badge tone={status.tone}>{status.label}</Badge>} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={BadgePercent} tone="violet" label="Comisión base" value={`${agency.commission_pct} %`} note={agency.price_list ?? "Lista de precios"} />
        <TintTile icon={ListChecks} tone="t3" label="Productos con tarifa" value={profile.rates} note="Asignados a tu agencia" />
        <TintTile icon={CalendarRange} tone={agency.status === "vencida" ? "bad" : "t1"} label="Vigencia" value={formatDate(agency.valid_to)} note={`Desde ${formatDate(agency.valid_from)}`} />
        <TintTile icon={Users} tone="t4" label="Usuarios" value={profile.users.length} note="Con acceso al portal" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={Building2} title="Datos del convenio">
            <dl>
              <Field label="Razón social" value={agency.name} />
              <Field label="RUC" value={agency.ruc} />
              <Field label="Código de convenio" value={agency.code} />
              <Field label="Contacto" value={agency.contact} />
              <Field label="Correo de reservas" value={agency.email ?? "—"} />
              <Field label="Cliente de facturación" value={agency.client ? `${agency.client.name} · ${agency.client.code}` : "—"} />
            </dl>
          </SectionCard>
          <SectionCard icon={Users} title="Usuarios de la agencia" aside={profile.users.length}>
            <ul className="flex flex-col gap-2">
              {profile.users.map((user, index) => (
                <li key={user.code} style={rise(index)} className={cn("lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                  <Avatar name={user.name} size="md" solid />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold">
                      {user.name}
                      {user.me && <span className="ml-2 text-[12px] font-medium text-fg-3">Tú</span>}
                    </b>
                    <span className="block truncate text-[12px] text-fg-3">
                      {user.email}
                      {user.last_login_at ? ` · Último ingreso ${formatDateTime(user.last_login_at)}` : " · Sin ingresos"}
                    </span>
                  </span>
                  <Badge tone={user.status === "activo" ? "ok" : "mute"}>{user.status === "activo" ? "Activo" : "Inactivo"}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] text-fg-3">Para dar de alta o retirar usuarios escribe a tu ejecutivo de cuenta.</p>
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <SectionCard icon={CreditCard} title="Línea de crédito">
            <CreditMeter credit={profile.credit} />
          </SectionCard>
          <SectionCard icon={ShieldCheck} title="Tu ejecutivo de cuenta">
            {profile.manager ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={profile.manager.name} size="md" solid />
                  <b className="text-[14px] font-semibold">{profile.manager.name}</b>
                </div>
                <a href={`mailto:${profile.manager.email}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg-2 transition hover:bg-surface-2 hover:text-fg">
                  <Mail size={14} /> {profile.manager.email}
                </a>
                {profile.manager.phone && (
                  <a href={`tel:${profile.manager.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg-2 transition hover:bg-surface-2 hover:text-fg">
                    <Phone size={14} /> {profile.manager.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-fg-3">Pronto te asignaremos un ejecutivo.</p>
            )}
          </SectionCard>
          <SectionCard icon={History} title="Movimientos de crédito" aside={profile.movements.length || undefined}>
            {profile.movements.length === 0 ? (
              <EmptyLine>Sin movimientos registrados en el libro de crédito.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.movements.map((row, index) => (
                  <li key={`${row.at}-${index}`} style={rise(index)} className={cn("flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2 text-[13px]", RISE)}>
                    <span className="min-w-0">
                      <b className="block">{MOVEMENT_TYPES[row.type] ?? row.type}</b>
                      <span className="text-[12px] text-fg-3">
                        {row.reservation ?? row.note ?? ""} · {formatDateTime(row.at)}
                      </span>
                    </span>
                    <span className="text-right">
                      <b className={cn("block", row.amount > 0 ? "text-warn" : "text-ok")}>
                        {row.amount > 0 ? "+" : ""}
                        {formatMoney(row.amount, row.currency)}
                      </b>
                      <span className="text-[11.5px] text-fg-3">Usado {formatMoney(row.balance, row.currency)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
