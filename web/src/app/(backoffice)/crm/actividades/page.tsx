import { AlarmClock, CalendarCheck, CalendarDays, CircleCheckBig } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { TintTile, ToneScope } from "@/components/ui/Tinted";
import { ActivityCreateAction, ActivityRowActions } from "@/features/activities/ActivityForms";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, BUCKETS, RELATION_LABEL, type ActivityItem } from "@/lib/activities";
import { formatDateTime, shortName } from "@/lib/format";
import { getAgenda, getRelatedOptions } from "@/lib/server/activities";
import { toneStyle } from "@/lib/tone";

export const metadata: Metadata = { title: "Actividades" };

const timeOnly = (iso: string) => formatDateTime(iso, false);

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const type = ACTIVITY_TYPES[activity.type];
  const Icon = type.icon;
  const done = activity.status === "completada";
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line-2 px-4 py-3 first:border-t-0">
      <span style={toneStyle(type.tone)} className={cn("grid h-9 w-9 flex-none place-items-center rounded-[10px]", done ? "bg-surface-2 text-fg-3" : "bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]")}>
        <Icon size={17} />
      </span>
      <div className="min-w-[200px] flex-1">
        <p className={cn("text-[13.5px] font-semibold", done && "text-fg-2 line-through decoration-fg-3/40")}>{activity.subject}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
          <span>{type.label}</span>
          {activity.related && (
            <Link href={activity.related.href} className="font-medium text-accent hover:underline">
              {RELATION_LABEL[activity.related.type]} · {activity.related.name}
            </Link>
          )}
        </p>
        {done && activity.result && <p className="mt-1 text-[12.5px] text-fg-2">{activity.result}</p>}
      </div>
      <span className={cn("text-[12.5px] font-medium", activity.bucket === "overdue" ? "text-bad" : "text-fg-2")}>{timeOnly(done && activity.completed_at ? activity.completed_at : activity.due_at)}</span>
      <Avatar name={activity.owner.name} size="xs" solid />
      <span className="sr-only">{shortName(activity.owner.name)}</span>
      {!done && <ActivityRowActions activity={activity} />}
    </li>
  );
}

export default async function ActividadesPage() {
  const [agenda, options] = await Promise.all([getAgenda(), getRelatedOptions()]);
  if (!agenda) return null;
  const { kpis } = agenda;

  return (
    <>
      <PageHeader title="Actividades" actions={options ? <ActivityCreateAction options={options} /> : undefined} />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={AlarmClock} tone="bad" label="Vencidas" value={kpis.overdue} />
        <TintTile icon={CalendarCheck} tone="t1" label="Para hoy" value={kpis.today} />
        <TintTile icon={CalendarDays} tone="violet" label="Próximos 7 días" value={kpis.week} />
        <TintTile icon={CircleCheckBig} tone="ok" label="Completadas esta semana" value={kpis.done_week} />
      </section>
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
                  <span className="text-[12.5px] text-fg-3">{items.length}</span>
                </header>
                <ul>
                  {(bucket.id === "done" ? [...items].reverse() : items).map((item) => (
                    <ActivityRow key={item.code} activity={item} />
                  ))}
                </ul>
              </section>
            </ToneScope>
          );
        })}
      </div>
    </>
  );
}
