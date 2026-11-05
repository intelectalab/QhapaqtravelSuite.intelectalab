import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList, SectionTitle, StatCard } from "@/components/ui/Details";
import { TenantStatusAction } from "@/features/platform/TenantStatusAction";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import { formatBytes, type TenantDetail } from "@/lib/platform";
import { getTenant } from "@/lib/server/platform";

const ACTION_LABELS: Record<string, string> = { suspender: "Suspendida", reactivar: "Reactivada", alta: "Alta de la agencia", cambio_plan: "Cambio de plan", acceso_denegado: "Acceso bloqueado" };

const dateTime = (iso: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(/\./g, "");

const detailOf = (value: string | null) => (value?.includes(" · ") ? value.split(" · ").slice(1).join(" · ") : null);

export async function generateMetadata({ params }: PageProps<"/plataforma/agencias/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getTenant(code)).name };
}

export default async function AgenciaPage({ params }: PageProps<"/plataforma/agencias/[code]">) {
  const { code } = await params;
  const tenant = await getTenant(code);

  return (
    <>
      <PageHeader
        back={{ href: "/plataforma/agencias", label: "Agencias" }}
        jump={false}
        leading={<Avatar name={tenant.name} size="lg" />}
        title={tenant.name}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={tenant.status} />
          </span>
        }
        subtitle={[tenant.code, `${tenant.subdomain}.qhapaq.cloud`, tenant.created_at ? `Alta el ${formatDate(tenant.created_at)}` : null].filter(Boolean).join(" · ")}
        actions={<TenantStatusAction tenant={tenant} />}
      />

      {tenant.status === "suspendido" && <SuspendedNotice tenant={tenant} />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ingreso mensual" value={formatMoney(tenant.mrr)} note={tenant.plan ? `Plan ${tenant.plan.name}` : undefined} />
        <StatCard label="Usuarios activos" value={tenant.users} />
        <StatCard label="Sedes" value={tenant.sedes} />
        <StatCard label="Almacenamiento" value={formatBytes(tenant.storage_used_bytes)} note={`${tenant.modules} módulos habilitados`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle title="Empresa" />
          <FieldList
            fields={[
              { label: "Razón social", value: tenant.legal_name },
              { label: "RUC", value: <span className="font-mono text-[13px]">{tenant.ruc}</span> },
              { label: "Tipo", value: tenant.business_type },
              { label: "Domicilio fiscal", value: <span className="whitespace-normal">{tenant.fiscal_address}</span> },
              { label: "Moneda y zona", value: `${tenant.base_currency} · ${tenant.timezone}` },
              { label: "Correo de contacto", value: tenant.admin_email },
              ...(tenant.trial_ends_at ? [{ label: "Prueba hasta", value: formatDate(tenant.trial_ends_at) }] : []),
            ]}
          />
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle title="Administradores" />
            {tenant.admins.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">Esta agencia todavía no tiene un administrador activo.</p>
            ) : (
              <ul className="flex flex-col">
                {tenant.admins.map((admin) => (
                  <li key={admin.email} className="flex items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
                    <Avatar name={admin.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{admin.name}</b>
                      <span className="block truncate text-xs text-fg-3">{admin.email}</span>
                    </span>
                    <span className="text-right text-xs text-fg-3">{admin.last_login_at ? `Ingresó el ${formatDate(admin.last_login_at)}` : "Aún no ingresa"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle title="Sedes" />
            <ul className="flex flex-col">
              {tenant.locations.map((location) => (
                <li key={location.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13.5px] first:border-t-0">
                  <span className="min-w-0 flex-1 truncate">{location.name}</span>
                  {location.is_main && <Badge tone="t1" dot={false}>Principal</Badge>}
                  <StatusBadge status={location.status} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <SectionTitle title="Historial de estado" />
        {tenant.history.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin cambios de estado desde el alta.</p>
        ) : (
          <ol className="flex flex-col">
            {tenant.history.map((event) => (
              <li key={`${event.occurred_at}-${event.action}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 border-t border-line-2 py-3 first:border-t-0">
                <b className="text-[13.5px] font-semibold">{ACTION_LABELS[event.action] ?? capitalize(event.action.replace(/_/g, " "))}</b>
                <span className="text-xs text-fg-3">{dateTime(event.occurred_at)}</span>
                <span className="text-[13px] text-fg-2">{detailOf(event.after_value) ?? event.after_value}</span>
                <span className="text-xs text-fg-3">{event.actor ?? "Sistema"}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function SuspendedNotice({ tenant }: { tenant: TenantDetail }) {
  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-card border border-bad/25 bg-bad/[0.06] px-4 py-3.5 text-[13.5px]">
      <CircleAlert size={18} className="mt-px flex-none text-bad" />
      <p>
        <b className="font-semibold text-bad">Agencia suspendida{tenant.suspended_at ? ` desde el ${formatDate(tenant.suspended_at)}` : ""}.</b>{" "}
        <span className="text-fg-2">Sus usuarios no pueden ingresar; los datos se conservan. Motivo: {tenant.suspend_reason}</span>
      </p>
    </div>
  );
}
