import { CalendarCheck, CircleCheck, CircleX, ClipboardCheck, Lock, LockOpen, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { ProgressBar } from "@/components/ui/MiniTable";
import { TintCardTitle } from "@/components/ui/Tinted";
import { ClosePeriodAction, ManualCheckToggle } from "@/features/finance/PeriodClose";
import { cn } from "@/lib/cn";
import type { PeriodCloseState } from "@/lib/finance";
import { formatDateTime } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cierre de periodo" };

const currentPeriod = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default async function CierrePage({ searchParams }: PageProps<"/finanzas/cierre">) {
  const { periodo } = await searchParams;
  const period = typeof periodo === "string" && /^\d{4}-\d{2}$/.test(periodo) ? periodo : currentPeriod();
  const state = await getResource<PeriodCloseState>(`/finance/period-closes/${period}`, "No pudimos cargar el cierre del periodo.");

  if (!state) {
    return <PageHeader title="Cierre de periodo" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const closed = state.status === "cerrado";
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Cierre de periodo"
        subtitle="Controles del mes contable antes de cerrarlo."
        info={<InfoTip>Los controles automáticos se calculan con los datos del periodo; los manuales los marca Contabilidad. Cerrar exige todos en orden y bloquea la emisión de comprobantes con fecha del periodo.</InfoTip>}
        actions={state.can.close ? <ClosePeriodAction state={state} /> : undefined}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={CalendarCheck} title="Periodos" />
          <ul className="flex flex-col gap-1">
            {state.periods.map((item) => (
              <li key={item.period}>
                <Link href={`/finanzas/cierre?periodo=${item.period}`} className={cn("flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] transition hover:bg-surface-2", item.period === state.period && "bg-surface-2 font-semibold")}>
                  {item.label}
                  {item.closed ? <Lock size={14} className="text-ok" aria-label="Cerrado" /> : <LockOpen size={14} className="text-fg-3" aria-label="Abierto" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span>
                <b className="block text-[18px] font-bold">{state.label}</b>
                <span className="text-[13px] text-fg-3">{closed ? `Cerrado${state.closed_by ? ` por ${state.closed_by}` : ""}${state.closed_at ? ` el ${formatDateTime(state.closed_at)}` : ""}` : `${state.done} de ${state.total} controles en orden`}</span>
              </span>
              <Badge tone={closed ? "ok" : pct === 100 ? "t1" : "warn"}>{closed ? "Cerrado" : pct === 100 ? "Listo para cerrar" : "Abierto"}</Badge>
            </div>
            <ProgressBar value={pct} tone={pct === 100 ? "ok" : pct >= 50 ? "warn" : "bad"} />
          </Card>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <Card>
              <TintCardTitle icon={ShieldCheck} title="Controles automáticos" />
              <ul className="flex flex-col gap-2">
                {state.automatic.map((check, index) => (
                  <li key={check.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex items-start gap-3 rounded-xl border border-line-2 px-3.5 py-3 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                    {check.ok ? <CircleCheck size={18} className="mt-0.5 flex-none text-ok" /> : <CircleX size={18} className="mt-0.5 flex-none text-bad" />}
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className="block font-semibold">{check.label}</b>
                      <span className="text-[12.5px] text-fg-3">{check.detail}</span>
                    </span>
                    {!check.ok && check.href && !closed && (
                      <Link href={check.href} className="flex-none text-[12.5px] font-semibold text-accent hover:underline">
                        Revisar
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <TintCardTitle icon={ClipboardCheck} title="Controles manuales" />
              <ul className="flex flex-col gap-3">
                {state.manual.map((check) => (
                  <li key={check.code} className="rounded-xl border border-line-2 px-3.5 py-3">
                    <ManualCheckToggle period={state.period} check={check} editable={state.can.manage} />
                    {check.ok && check.checked_by && (
                      <p className="mt-1.5 text-[12px] text-fg-3">
                        Marcado por {check.checked_by}
                        {check.checked_at ? ` · ${formatDateTime(check.checked_at)}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
