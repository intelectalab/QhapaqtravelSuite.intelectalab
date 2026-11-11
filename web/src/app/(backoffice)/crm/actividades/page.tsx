import { AlarmClock, CalendarCheck, CalendarDays, CircleCheckBig } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { TintTile, ToneScope } from "@/components/ui/Tinted";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { ActivityCreateAction } from "@/features/activities/ActivityForms";
import { ActivityRow } from "@/features/activities/ActivityRow";
import { ActivityWeek, weekStart } from "@/features/activities/ActivityWeek";
import { BUCKETS } from "@/lib/activities";
import { TIME_ZONE } from "@/lib/format";
import { getAgenda, getRelatedOptions } from "@/lib/server/activities";

export const metadata: Metadata = { title: "Actividades" };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function ActividadesPage({ searchParams }: PageProps<"/crm/actividades">) {
  const { vista, semana } = await searchParams;
  const [agenda, options] = await Promise.all([getAgenda(), getRelatedOptions()]);
  if (!agenda) return null;
  const { kpis } = agenda;
  const weekMode = vista === "semana";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(agenda.now));
  const start = weekStart(typeof semana === "string" && ISO_DAY.test(semana) ? semana : today);

  return (
    <>
      <PageHeader title="Actividades" actions={options ? <ActivityCreateAction options={options} /> : undefined} />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={AlarmClock} tone="bad" label="Vencidas" value={kpis.overdue} info={<p>Actividades pendientes de tu agenda cuya fecha y hora ya pasaron.</p>} />
        <TintTile icon={CalendarCheck} tone="t1" label="Para hoy" value={kpis.today} info={<p>Actividades pendientes programadas para lo que queda del día, en la hora de la agencia.</p>} />
        <TintTile icon={CalendarDays} tone="violet" label="Próximos 7 días" value={kpis.week} info={<p>Actividades pendientes de mañana hasta dentro de siete días.</p>} />
        <TintTile icon={CircleCheckBig} tone="ok" label="Completadas en 7 días" value={kpis.done_week} info={<p>Actividades marcadas como completadas en los últimos siete días, con su resultado registrado.</p>} />
      </section>
      <ViewSwitch
        label="Vista de actividades"
        className="mb-4"
        modes={[
          { href: "/crm/actividades", label: "Lista", active: !weekMode },
          { href: "/crm/actividades?vista=semana", label: "Semana", active: weekMode },
        ]}
      />
      {weekMode ? (
        <ActivityWeek items={agenda.items} start={start} today={today} basePath="/crm/actividades?vista=semana" />
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKETS.map((bucket) => {
            const items = agenda.items.filter((item) => item.bucket === bucket.id);
            if (items.length === 0) return null;
            return (
              <ToneScope key={bucket.id} tone={bucket.tone}>
                <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                  <header className="flex items-center gap-2.5 border-b border-line bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" />
                    <h2 className="text-[13.5px] font-bold">{bucket.title}</h2>
                    {(bucket.id === "later" || bucket.id === "done") && <span className="text-[12.5px] text-fg-3">{items.length}</span>}
                  </header>
                  <ul>
                    {(bucket.id === "done" ? [...items].reverse() : items).map((item) => (
                      <ActivityRow key={item.code} activity={item} options={options} />
                    ))}
                  </ul>
                </section>
              </ToneScope>
            );
          })}
        </div>
      )}
    </>
  );
}
