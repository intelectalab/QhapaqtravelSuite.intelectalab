import { Building2, CalendarClock, CircleAlert, CirclePause, CirclePlay, History, MapPin, ShieldCheck, Ticket, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { HeroBand, HeroChip, HeroPanel, SOFT_TINT, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { TenantEditAction, TenantPlanAction, TenantScheduledChange } from "@/features/platform/TenantManageActions";
import { TenantStatusAction } from "@/features/platform/TenantStatusAction";
import { TenantUsage } from "@/features/platform/TenantUsage";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime, formatMoney, initials } from "@/lib/format";
import { CYCLE_LABEL, planTone, type TenantDetail } from "@/lib/platform";
import { getProvisionOptions, getTenant, listPlans } from "@/lib/server/platform";

const ACTIONS: Record<string, { label: string; tone: "bad" | "ok" | "t1" | "warn"; icon: typeof History }> = {
  suspender: { label: "Suspendida", tone: "bad", icon: CirclePause },
  reactivar: { label: "Reactivada", tone: "ok", icon: CirclePlay },
  alta: { label: "Alta de la agencia", tone: "t1", icon: Building2 },
  cambio_plan: { label: "Cambio de plan", tone: "t1", icon: Ticket },
  cambio_plan_programado: { label: "Cambio de plan programado", tone: "t1", icon: CalendarClock },
  anular_cambio_programado: { label: "Cambio de plan anulado", tone: "warn", icon: Undo2 },
  convertir_trial: { label: "Prueba convertida", tone: "ok", icon: Ticket },
  extender_trial: { label: "Prueba extendida", tone: "t1", icon: CalendarClock },
  acceso_denegado: { label: "Acceso bloqueado", tone: "warn", icon: ShieldCheck },
};

const detailOf = (value: string | null) => (value?.includes(" · ") ? value.split(" · ").slice(1).join(" · ") : null);

export async function generateMetadata({ params }: PageProps<"/plataforma/agencias/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getTenant(code)).name };
}

export default async function AgenciaPage({ params, searchParams }: PageProps<"/plataforma/agencias/[code]">) {
  const { code } = await params;
  const { editar } = await searchParams;
  const [tenant, plans, options] = await Promise.all([getTenant(code), listPlans(), getProvisionOptions()]);
  const tone = tenant.status === "suspendido" ? "mute" : planTone(tenant.plan?.rank ?? 1);

  return (
    <ToneScope tone={tone}>
      <PageHeader
        back={{ href: "/plataforma/agencias", label: "Agencias" }}
        jump={false}
        leading={<span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-lg font-bold text-white shadow-[0_10px_24px_-12px_var(--tint)]">{tenant.initials || initials(tenant.name)}</span>}
        title={tenant.name}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={tenant.status} />
          </span>
        }
        subtitle={[tenant.code, `${tenant.subdomain}.kipucontrol.com`, tenant.created_at ? `Alta el ${formatDate(tenant.created_at)}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <TenantEditAction tenant={tenant} options={options} defaultOpen={editar === "1"} />
            <TenantPlanAction tenant={tenant} plans={plans} />
            <TenantStatusAction tenant={tenant} />
          </>
        }
      />

      {tenant.status === "suspendido" && <SuspendedNotice tenant={tenant} />}
      <TenantScheduledChange tenant={tenant} />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Ingreso mensual</p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">{formatMoney(tenant.mrr)}</p>
            <p className="mt-2 text-[13.5px] text-white/75">{tenant.status === "prueba" && tenant.trial_ends_at ? `En prueba hasta el ${formatDate(tenant.trial_ends_at)}` : `${formatMoney(Number(tenant.mrr) * 12)} al año`}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {tenant.plan && (
                <Link href={`/plataforma/planes/${tenant.plan.code}`} className="rounded-full transition hover:brightness-110">
                  <HeroChip icon={<Ticket size={14} />}>Plan {tenant.plan.name}</HeroChip>
                </Link>
              )}
              {tenant.subscription && tenant.subscription.status !== "trialing" && (
                <HeroChip icon={<CalendarClock size={14} />}>
                  Pago {CYCLE_LABEL[tenant.subscription.cycle].toLowerCase()} · renueva el {formatDate(tenant.subscription.period_end)}
                </HeroChip>
              )}
            </div>
          </div>
          <HeroPanel>
            <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
              <Building2 size={15} />
              {tenant.legal_name}
            </p>
            <dl className="grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
              <HeroFact label="RUC" value={tenant.ruc} />
              <HeroFact label="Tipo" value={tenant.business_type} />
              <HeroFact label="Moneda y zona" value={`${tenant.base_currency} / ${tenant.alt_currency} · ${tenant.timezone}`} />
              <HeroFact label="País e idioma" value={`${tenant.country} · ${tenant.locale}`} />
              <HeroFact label="Contacto" value={tenant.admin_email} />
            </dl>
          </HeroPanel>
        </div>
      </HeroBand>

      <TenantUsage tenant={tenant} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={MapPin} title="Domicilio y sedes" aside={String(tenant.locations.length)} />
          <p className={cn("mb-3 rounded-[11px] px-3 py-2.5 text-[13px]", SOFT_TINT)}>{tenant.fiscal_address}</p>
          <ul className="flex flex-col">
            {tenant.locations.map((location) => (
              <li key={location.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13.5px] first:border-t-0">
                <span className="min-w-0 flex-1 truncate font-medium">{location.name}</span>
                {location.is_main && <Badge tone="t1" dot={false}>Principal</Badge>}
                <StatusBadge status={location.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <TintCardTitle icon={ShieldCheck} title="Administradores" aside={String(tenant.admins.length)} />
          {tenant.admins.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Esta agencia todavía no tiene un administrador activo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tenant.admins.map((admin) => (
                <li key={admin.email} className={cn("flex items-center gap-3 rounded-[12px] px-3 py-2.5", SOFT_TINT)}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--tint)] text-xs font-semibold text-white">{initials(admin.name)}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold">{admin.name}</b>
                    <span className="block truncate text-xs text-fg-3">{admin.email}</span>
                  </span>
                  <span className="text-right text-xs text-fg-3">{admin.last_login_at ? `Ingresó el ${formatDate(admin.last_login_at)}` : "Aún no ingresa"}</span>
                </li>
              ))}
            </ul>
          )}
          {tenant.trial_ends_at && (
            <div className="mt-4">
              <FieldList fields={[{ label: "Prueba hasta", value: formatDate(tenant.trial_ends_at) }]} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <TintCardTitle icon={History} title="Historial de estado" />
        {tenant.history.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin cambios de estado desde el alta.</p>
        ) : (
          <ol className="relative flex flex-col gap-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
            {tenant.history.map((event, index) => {
              const action = ACTIONS[event.action] ?? { label: capitalize(event.action.replace(/_/g, " ")), tone: "t1" as const, icon: History };
              const Icon = action.icon;
              return (
                <li key={`${event.occurred_at}-${event.action}-${index}`} className="relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 py-2">
                  <ToneScope tone={action.tone}>
                    <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--tint)] text-white ring-4 ring-surface">
                      <Icon size={15} />
                    </span>
                  </ToneScope>
                  <span className="min-w-0 pt-0.5">
                    <b className="block text-[13.5px] font-semibold">{action.label}</b>
                    <span className="block text-[13px] text-fg-2">{detailOf(event.after_value) ?? event.after_value}</span>
                  </span>
                  <span className="pt-0.5 text-right text-xs text-fg-3">
                    {formatDateTime(event.occurred_at)}
                    <span className="block">{event.actor ?? "Sistema"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </ToneScope>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-white/60">{label}</dt>
      <dd className="truncate font-medium text-white/95">{value}</dd>
    </div>
  );
}

function SuspendedNotice({ tenant }: { tenant: TenantDetail }) {
  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-card border border-bad/25 bg-bad/[0.08] px-4 py-3.5 text-[13.5px]">
      <CircleAlert size={18} className="mt-px flex-none text-bad" />
      <p>
        <b className="font-semibold text-bad">Agencia suspendida{tenant.suspended_at ? ` desde el ${formatDate(tenant.suspended_at)}` : ""}.</b>{" "}
        <span className="text-fg-2">Sus usuarios no pueden ingresar; los datos se conservan. Motivo: {tenant.suspend_reason}</span>
      </p>
    </div>
  );
}
