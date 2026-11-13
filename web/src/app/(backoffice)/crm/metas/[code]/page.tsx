import { Award, CalendarClock, Gauge, History, LayoutDashboard, ListChecks, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { TargetAdjustmentsSection, TargetBreakdownSection, TargetDefinition, TargetFlow, TargetHistorySection, TargetProgressSection, TargetStatusBadges } from "@/features/targets/TargetDetailSections";
import { TargetAdjustAction, TargetStepAction, TargetVoidAction } from "@/features/targets/TargetForms";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import { getCachedResource } from "@/lib/server/resource";
import { targetHref, type TargetDetail } from "@/lib/targets";
import { statusLabel } from "@/lib/tone";

const load = (code: string) => getCachedResource<TargetDetail>(`/crm/sales-targets/${encodeURIComponent(code)}`, "No pudimos cargar la meta.");

export async function generateMetadata({ params }: PageProps<"/crm/metas/[code]">): Promise<Metadata> {
  const { code } = await params;
  const detail = await load(code);
  return { title: detail ? `${detail.target.scope.name} · ${detail.target.period_label}` : "Meta comercial" };
}

export default async function MetaPage({ params, searchParams }: PageProps<"/crm/metas/[code]">) {
  const { code } = await params;
  const { seccion } = await searchParams;
  const detail = await load(code);

  if (!detail) {
    return <PageHeader back={{ href: "/crm/metas", label: "Metas comerciales" }} title="Meta comercial" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { target, commission, breakdown, history, adjustments, can, policy } = detail;
  const byAdvisor = target.scope_type !== "asesor";
  const open = target.status === "vigente" || target.status === "borrador";
  const covered = breakdown.reduce((total, row) => total + (row.goal ?? 0), 0);
  const tiers = policy.tiers.map((tier) => `${tier.min} % paga ${tier.pay} %`).join(", ");

  const { active, groups } = resolveSections(
    targetHref(target.code),
    [
      { group: "Meta", id: "avance", label: "Avance", icon: <LayoutDashboard size={15} /> },
      { group: "Meta", id: "desglose", label: byAdvisor ? "Por asesor" : "Equipo y sede", icon: <Users size={15} />, count: breakdown.length || undefined },
      { group: "Control", id: "historico", label: "Otros períodos", icon: <History size={15} />, count: history.length || undefined },
      { group: "Control", id: "ajustes", label: "Ajustes", icon: <ListChecks size={15} />, count: adjustments.length || undefined },
    ],
    seccion,
  );

  const tabs = groups.flatMap((group) => group.items).map((item) => ({ id: item.id, href: item.href, label: item.label, count: item.count }));

  const body = (() => {
    switch (active) {
      case "desglose":
        return <TargetBreakdownSection target={target} rows={breakdown} />;
      case "historico":
        return <TargetHistorySection rows={history} />;
      case "ajustes":
        return <TargetAdjustmentsSection rows={adjustments} />;
      default:
        return (
          <>
            <TargetDefinition target={target} members={breakdown} tiers={policy.tiers} ranking={detail.ranking ?? []} />
            <TargetProgressSection target={target} />
          </>
        );
    }
  })();

  return (
    <>
      <PageHeader
        back={{ href: "/crm/metas", label: "Metas comerciales" }}
        jump={false}
        title={`${target.scope.name} · ${target.period_label}`}
        info={<TargetStatusBadges target={target} />}
        subtitle={[target.scope_label, target.code, `${formatDate(target.period_from)} al ${formatDate(target.period_to)}`].join(" · ")}
        actions={
          can.manage ? (
            <>
              <TargetStepAction target={target} manage={can.manage} />
              <TargetAdjustAction target={target} lockPct={policy.lock_decrease_after_pct} canReduceLate={can.reduce_late} asButton />
              <TargetVoidAction target={target} asButton />
            </>
          ) : undefined
        }
      />
      <TargetFlow target={target} />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile
          icon={Gauge}
          tone={target.progress_pct >= 100 ? "ok" : "t1"}
          label="Cumplimiento"
          value={formatPercent(target.progress_pct, 0)}
          note={`${formatMoney(target.actual.sales)} de ${formatMoney(target.goals.sales)}`}
          info={<p>Reservas confirmadas creadas en el período, en soles con el tipo de cambio de cada reserva, contra la meta de ventas.{target.status === "cerrada" ? " El período está cerrado: el resultado quedó congelado." : ""}</p>}
        />
        <TintTile
          icon={TrendingUp}
          tone="violet"
          label="Proyección al cierre"
          value={formatPercent(target.projection_pct, 0)}
          note={formatMoney(target.projection)}
          info={<p>Lo vendido más las oportunidades abiertas que cierran dentro del período, multiplicadas por su probabilidad.</p>}
        />
        <TintTile
          icon={CalendarClock}
          tone="info"
          label={open ? "Días por delante" : "Período"}
          value={open ? target.days_left : target.status === "cerrada" ? "Cerrado" : "Anulado"}
          note={open ? `${target.elapsed_pct} % transcurrido` : target.closed_at ? `El ${formatDate(target.closed_at)}` : undefined}
          info={<p>Días que faltan para el fin del período y porcentaje del período que ya pasó. Pasado el {policy.lock_decrease_after_pct} %, solo el administrador reduce la meta.</p>}
        />
        {commission ? (
          <TintTile
            icon={Award}
            tone="sun"
            label="Bono liquidado"
            value={formatMoney(commission.amount)}
            note={
              commission.can_open ? (
                <Link href={`/finanzas/comisiones/${encodeURIComponent(commission.code)}`} className="font-mono text-[var(--tint)] hover:underline">
                  {commission.code} · {statusLabel(commission.status)}
                </Link>
              ) : (
                `${commission.code} · ${statusLabel(commission.status)}`
              )
            }
            info={<p>Comisión «Bono por meta» que se generó al cerrar el período con el tramo del cumplimiento final ({tiers}). Finanzas la aprueba y la paga.</p>}
          />
        ) : target.bonus ? (
          <TintTile icon={Award} tone="sun" label="Bono estimado" value={formatMoney(target.bonus.estimated)} note={`${target.bonus.pct} % de ${formatMoney(target.bonus.amount)}`} info={<p>Bono base por el tramo que alcanza {target.status === "cerrada" ? "el cumplimiento final" : "la proyección"}: {tiers}.</p>} />
        ) : byAdvisor ? (
          <TintTile icon={Users} tone="sun" label="Cobertura" value={formatPercent(target.goals.sales > 0 ? (covered / target.goals.sales) * 100 : 0, 0)} note={`${formatMoney(covered)} en metas de asesor`} info={<p>Suma de las metas de asesor del período de quienes integran {target.scope_type === "equipo" ? "el equipo" : "la sede"}, frente a la meta de {target.scope_label.toLowerCase()}.</p>} />
        ) : (
          <TintTile icon={Award} tone="sun" label="Bono estimado" value="Sin bono" info={<p>Esta meta no tiene bono base definido.</p>} />
        )}
      </section>
      <TabbedCard tabs={tabs} active={tabs.find((tab) => tab.id === active)?.href}>
        {body}
      </TabbedCard>
    </>
  );
}
