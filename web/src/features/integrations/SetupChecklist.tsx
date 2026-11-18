import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { RISE } from "@/features/admin/AdminParts";
import { pendingItems, type IntegrationReadiness } from "@/lib/integrations";
import { ConnectionRow } from "./AgencyConnections";

export function SetupChecklist({ readiness }: { readiness: IntegrationReadiness | null }) {
  const pending = pendingItems(readiness);
  if (!readiness?.can_manage || pending.length === 0) return null;
  const total = readiness.items.length;
  const done = total - pending.length;

  return (
    <div className={`${RISE} mb-5`} data-testid="setup-checklist">
      <Card>
        <TintCardTitle
          icon={ListChecks}
          tone="sun"
          title="Completa tu configuración"
          aside={
            <span className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
              {done} de {total} listas
              <InfoTip>Sale de las conexiones de tu agencia en Administración › Integraciones. Mientras falte una, la función que la usa te avisa y no envía nada.</InfoTip>
            </span>
          }
        />
        <div className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avance de la configuración">
          <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
        <div className="grid gap-2.5 lg:grid-cols-2">
          {pending.map((item) => (
            <ConnectionRow key={item.key} item={{ ...item, href: item.key === "email" ? "/admin/integraciones?conectar=correo" : item.href }} mail={null} manage compact />
          ))}
        </div>
      </Card>
    </div>
  );
}
