import { Gauge, Layers } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { UsageBar } from "@/features/admin/AdminParts";
import { formatDate } from "@/lib/format";
import type { TenantDetail } from "@/lib/platform";
import type { Tone } from "@/lib/tone";
import { PLAN_LIMITS } from "./planLimits";

const SOURCE: Record<string, { label: string; tone: Tone }> = {
  plan: { label: "Plan", tone: "t1" },
  addon: { label: "Complemento", tone: "violet" },
  override: { label: "Excepción", tone: "sun" },
};

export function TenantUsage({ tenant }: { tenant: TenantDetail }) {
  const extras = tenant.entitlements.filter((feature) => feature.source !== "plan");
  return (
    <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card>
        <TintCardTitle icon={Gauge} title="Uso contra el plan" aside={<InfoTip>Usuarios, sedes y almacenamiento se cuentan hoy. Reservas, WhatsApp, correos y API suman lo consumido en el mes en curso. El límite es el del plan más los complementos contratados.</InfoTip>} />
        <div className="grid gap-3 sm:grid-cols-2">
          {tenant.usage.map((metric, index) => {
            const info = PLAN_LIMITS.find((item) => item.metric === metric.metric);
            return (
              <div key={metric.metric} style={{ animationDelay: `${index * 50}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                <UsageBar used={metric.used} limit={metric.limit} label={info?.label ?? metric.metric} unit={info?.unit ?? ""} note={metric.limit !== null && metric.limit > 0 && metric.used >= metric.limit ? "Llegó al límite del plan" : metric.limit !== null && metric.used >= metric.limit * 0.8 ? "Cerca del límite" : undefined} />
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <TintCardTitle icon={Layers} title="Funciones habilitadas" aside={String(tenant.entitlements.length)} />
        {tenant.entitlements.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Esta agencia no tiene funciones habilitadas.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {tenant.entitlements.map((feature) => (
              <li key={feature.key} title={feature.valid_until ? `${SOURCE[feature.source]?.label ?? feature.source} hasta el ${formatDate(feature.valid_until)}` : (SOURCE[feature.source]?.label ?? feature.source)}>
                <Badge tone={SOURCE[feature.source]?.tone ?? "mute"} dot={false}>
                  {feature.label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {extras.length > 0 && <p className="mt-3 text-[12.5px] text-fg-3">{extras.length === 1 ? "1 función llega" : `${extras.length} funciones llegan`} por complemento o excepción, fuera del plan.</p>}
      </Card>
    </div>
  );
}
