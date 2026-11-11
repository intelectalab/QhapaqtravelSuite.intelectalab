import { BedDouble, Coins, Gauge, Ticket, TimerReset, TrainFront } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { ContractDeleteAction, ContractEditAction, ContractReleaseAction } from "@/features/catalog-allotments/AllotmentForms";
import { ALLOTMENT_STATUS, isClosed } from "@/lib/catalog-allotments";
import { formatDate, formatMoney } from "@/lib/format";
import { getAllotment } from "@/lib/server/allotments";

const ICONS = { hotel: BedDouble, tren: TrainFront, entrada: Ticket };

export default async function CupoLayout({ children, params }: { children: ReactNode; params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getAllotment(code);
  if (!detail) notFound();
  const { contract, window } = detail;
  const base = `/catalogo/cupos/${encodeURIComponent(contract.code)}`;
  const open = !isClosed(contract.status);
  const free = detail.days.filter((day) => day.date >= detail.today && !day.closed).reduce((sum, day) => sum + (day.available ?? 0), 0);
  const pendingUnits = detail.pending.reduce((sum, day) => sum + (day.available ?? 0), 0);
  const Icon = ICONS[contract.kind];

  return (
    <>
      <PageHeader
        back={{ href: "/catalogo/cupos/contratos", label: "Contratos de cupo" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-12px_var(--accent)]">
            <Icon size={24} />
          </span>
        }
        title={contract.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={ALLOTMENT_STATUS[contract.status].tone}>{ALLOTMENT_STATUS[contract.status].label}</Badge>
          </span>
        }
        subtitle={`${contract.code} · ${contract.provider.name}${contract.contract_ref ? ` · ${contract.contract_ref}` : ""}`}
        actions={
          detail.can.manage ? (
            <>
              {contract.status !== "liberado" && <ContractEditAction contract={contract} today={detail.today} />}
              {open && <ContractReleaseAction contract={contract} units={free} />}
              <ContractDeleteAction contract={contract} />
            </>
          ) : undefined
        }
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Icon} tone="t1" label="Cupo vigente" value={window.capacity} note={`${window.blocked} bloqueadas · ${window.released} liberadas`} info={<p>Unidades bloqueadas menos liberadas en los 30 días desde el {formatDate(detail.window_from)}. Incluye las ampliaciones aceptadas.</p>} />
        <TintTile icon={Gauge} tone={window.utilization < 30 ? "warn" : "ok"} label="Uso en 30 días" value={`${window.utilization} %`} note={`${window.used} usadas · ${window.pending} en trámite`} info={<p>Unidades de reservas con el servicio confirmado sobre el cupo vigente. Las solicitadas o pendientes quedan en trámite y no consumen.</p>} />
        <TintTile
          icon={TimerReset}
          tone="sun"
          label="Release en 3 días"
          value={detail.upcoming.length}
          note={detail.pending.length ? `${detail.pending.length} fechas vencidas, ${pendingUnits} unidades` : "Sin releases vencidos"}
          info={<p>Fechas con unidades sin vender cuyo release vence en los próximos tres días. Las vencidas sin retención se devuelven en la próxima ejecución del release.</p>}
        />
        <TintTile
          icon={Coins}
          tone="violet"
          label="Penalidades"
          value={formatMoney(detail.penalties, contract.currency)}
          note={detail.exposure ? `${formatMoney(detail.exposure, contract.currency)} en riesgo` : `${contract.penalty_pct} % de la tarifa neta`}
          info={
            <div>
              <p>Cargos por no uso de fechas pasadas. El riesgo son las {detail.exposure_units} unidades retenidas después del release que aún no se venden.</p>
              {detail.charges.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {detail.charges.map((charge) => (
                    <li key={charge.date} className="flex justify-between gap-3">
                      <span>{formatDate(charge.date)} · {charge.qty} u.</span>
                      <b>{formatMoney(charge.amount, charge.currency)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
        />
      </section>
      <TabbedCard
        tabs={[
          { href: base, label: "Calendario" },
          { href: `${base}/condiciones`, label: "Condiciones" },
          { href: `${base}/consumo`, label: "Consumo" },
          { href: `${base}/ampliaciones`, label: "Ampliaciones" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
