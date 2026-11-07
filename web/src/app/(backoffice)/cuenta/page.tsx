import { Building2, CalendarClock, Coins, Globe2, KeyRound, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { DisableMfaAction } from "@/features/account/DisableMfaAction";
import type { TenantProfile } from "@/lib/account";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/me";
import { apiFetch } from "@/lib/server/api";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: "Mi cuenta y mi agencia" };

const dash = <span className="text-fg-3">—</span>;

export default async function CuentaPage() {
  const [me, profile] = await Promise.all([currentUser(), apiFetch<TenantProfile>("/me/tenant")]);
  if (!profile.ok || !profile.data) return <NoAccess home="/dashboard" />;
  const agency = profile.data;

  return (
    <>
      <PageHeader
        title="Mi cuenta y mi agencia"
        subtitle={`${me.name} · ${roleLabel(me.role)} en ${agency.commercial_name}`}
        jump={false}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Building2} tone="t1" label="Plan" value={agency.plan?.name ?? "Sin plan"} note={agency.trial_ends_at ? `Prueba hasta el ${formatDate(agency.trial_ends_at)}` : agency.status_label} />
        <TintTile icon={MapPin} tone="t2" label="Sedes" value={agency.sedes} note={agency.main_sede ? `Principal: ${agency.main_sede.name}` : undefined} />
        <TintTile icon={Users} tone="t3" label="Usuarios activos" value={agency.active_users} note={agency.my_sede ? `Tu sede: ${agency.my_sede.name}` : undefined} />
        <TintTile icon={Coins} tone="t4" label="Moneda base" value={agency.base_currency} note={agency.alt_currency ? `También ${agency.alt_currency}` : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <TintCardTitle icon={Building2} title="Ficha de la agencia" aside={<StatusBadge status={agency.status} label={agency.status_label} />} />
          <div data-testid="tenant-profile">
            <FieldList
              fields={[
                { label: "Nombre comercial", value: agency.commercial_name },
                { label: "Razón social", value: agency.legal_name },
                { label: "RUC", value: agency.ruc ? <span className="font-mono">{agency.ruc}</span> : dash },
                { label: "Código", value: <span className="font-mono">{agency.code}</span> },
                { label: "Subdominio", value: agency.subdomain ?? dash },
                { label: "Correo", value: agency.contact.email ?? dash },
                { label: "Teléfono", value: agency.contact.phone ?? dash },
                { label: "Web", value: agency.contact.web ?? dash },
              ]}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Globe2} title="Región y precios" />
            <FieldList
              fields={[
                { label: "Zona horaria", value: agency.timezone },
                { label: "Idioma", value: agency.locale ?? dash },
                { label: "Formato de fecha", value: agency.date_format ?? dash },
                { label: "IGV", value: agency.tax_pct === null ? dash : `${agency.tax_pct} %${agency.price_with_tax ? " · precios con IGV" : " · precios sin IGV"}` },
                { label: "Canales activos", value: agency.channels.length ? agency.channels.map((channel) => channel.label).join(", ") : dash },
              ]}
            />
          </Card>

          <Card>
            <TintCardTitle icon={ShieldCheck} title="Tu acceso" />
            <FieldList
              fields={[
                { label: "Nombre", value: me.name },
                { label: "Correo", value: me.email },
                { label: "Rol", value: roleLabel(me.role) },
                { label: "Sede", value: me.sede.name ?? dash },
              ]}
            />
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3" data-testid="account-mfa" data-state={me.mfa_enabled ? "activa" : "inactiva"}>
              <KeyRound size={18} className={me.mfa_enabled ? "flex-none text-ok" : "flex-none text-fg-3"} />
              <span className="min-w-0 flex-1 text-[13px]">
                <b className="block font-semibold">Verificación en dos pasos {me.mfa_enabled ? "activa" : "desactivada"}</b>
                <span className="text-[12.5px] text-fg-3">
                  {me.mfa_required ? "Tu rol la exige: no se puede desactivar." : me.mfa_enabled ? "Puedes desactivarla porque tu rol no la exige." : "Recomendada: pide un código de tu teléfono además de la contraseña."}
                </span>
              </span>
              {me.mfa_enabled && !me.mfa_required && <DisableMfaAction />}
              {!me.mfa_enabled && (
                <Button href="/mfa?configurar=1" variant="primary" data-testid="account-mfa-enable">
                  Activar
                </Button>
              )}
            </div>
            <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
              <CalendarClock size={14} />
              Los cambios de la ficha de la agencia los hace la administración en Configuración.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
