import { Coins, Gauge, Layers, ShieldAlert, TimerReset } from "lucide-react";
import { TintTile } from "@/components/ui/Tinted";
import { isClosed, type AllotmentsOverview } from "@/lib/catalog-allotments";
import { formatMoney, formatNumber } from "@/lib/format";

export function AllotmentTiles({ overview }: { overview: AllotmentsOverview }) {
  const open = overview.contracts.filter((row) => !isClosed(row.status));
  const capacity = open.reduce((sum, row) => sum + row.window.capacity, 0);
  const used = open.reduce((sum, row) => sum + row.window.used, 0);
  const utilization = capacity ? Math.round((used / capacity) * 100) : 0;
  const upcoming = overview.alerts.filter((alert) => alert.type === "proximo");
  const exposure = open.reduce((sum, row) => sum + row.exposure_pen, 0);
  const penalties = overview.contracts.reduce((sum, row) => sum + row.penalties_pen, 0);
  const releasing = open.filter((row) => row.status === "en_release").length;

  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <TintTile icon={Layers} tone="t1" label="Contratos vigentes" value={open.length} note={releasing ? `${releasing} con release pendiente` : "Todos al día"} info={<p>Contratos activos o en release. Un contrato pasa a en release cuando una fecha futura venció su plazo sin venderse ni retenerse.</p>} />
      <TintTile icon={Gauge} tone={utilization < 40 ? "warn" : "ok"} label="Uso en 30 días" value={`${utilization} %`} note={`${formatNumber(used)} de ${formatNumber(capacity)} unidades`} info={<p>Unidades consumidas por reservas confirmadas sobre el cupo vigente (bloqueado menos liberado) de los próximos 30 días.</p>} />
      <TintTile
        icon={TimerReset}
        tone="sun"
        label="Release en 3 días"
        value={upcoming.length}
        note={`${formatNumber(upcoming.reduce((sum, alert) => sum + alert.units, 0))} unidades por vencer`}
        info={<p>Fechas con unidades sin vender cuyo plazo de release vence en los próximos tres días. Si no se venden ni se retienen, el release automático las devuelve al proveedor.</p>}
      />
      <TintTile icon={ShieldAlert} tone="bad" label="Exposición a penalidad" value={formatMoney(exposure, "PEN")} note="Retenido después del release" info={<p>Lo que se pagaría si las unidades retenidas después del release no se venden: unidades × tarifa neta × penalidad del contrato. Los montos en dólares se pasan a soles al tipo de cambio {overview.usd_rate.toFixed(3)}.</p>} />
      <TintTile
        icon={Coins}
        tone="violet"
        label="Penalidades devengadas"
        value={formatMoney(penalties, "PEN")}
        note="Cargos por no uso"
        info={
          <div>
            <p>Cargos que registró el release por fechas pasadas con unidades sin usar ni liberar. Cada cargo con monto genera una cuenta por pagar al proveedor.</p>
            <ul className="mt-2 flex flex-col gap-1">
              {overview.contracts
                .filter((row) => row.penalties > 0)
                .map((row) => (
                  <li key={row.code} className="flex justify-between gap-3">
                    <span className="truncate">{row.provider.name}</span>
                    <b>{formatMoney(row.penalties, row.currency)}</b>
                  </li>
                ))}
            </ul>
          </div>
        }
      />
    </section>
  );
}
