import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, type ActivityItem } from "@/lib/activities";
import { shortName, TIME_ZONE } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { activityHref } from "./ActivityRow";

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);

const hour = (iso: string) => new Intl.DateTimeFormat("es-PE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const atNoon = (key: string) => new Date(`${key}T12:00:00Z`);

const shift = (key: string, days: number) => {
  const date = atNoon(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function weekStart(reference: string): string {
  const day = atNoon(reference).getUTCDay();
  return shift(reference, day === 0 ? -6 : 1 - day);
}

export function ActivityWeek({ items, start, today, basePath }: { items: ActivityItem[]; start: string; today: string; basePath: string }) {
  const days = Array.from({ length: 7 }, (_, index) => shift(start, index));
  const byDay = new Map(days.map((day) => [day, [] as ActivityItem[]]));
  for (const item of items) {
    const key = dayKey(new Date(item.status === "completada" && item.completed_at ? item.completed_at : item.due_at));
    byDay.get(key)?.push(item);
  }
  const label = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", ...options }).format(atNoon(key));
  const range = `${label(days[0], { day: "numeric", month: "short" })} al ${label(days[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-bold">Semana del {range}</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <Button href={`${basePath}&semana=${shift(start, -7)}`} variant="ghost" size="sm" iconOnly icon={<ChevronLeft size={16} />} label="Semana anterior" />
          <Button href={`${basePath}&semana=${weekStart(today)}`} variant="secondary" size="sm">
            Esta semana
          </Button>
          <Button href={`${basePath}&semana=${shift(start, 7)}`} variant="ghost" size="sm" iconOnly icon={<ChevronRight size={16} />} label="Semana siguiente" />
        </div>
      </header>
      <div className="scroll-thin overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7 divide-x divide-line-2">
          {days.map((day) => {
            const list = (byDay.get(day) ?? []).sort((a, b) => a.due_at.localeCompare(b.due_at));
            const isToday = day === today;
            return (
              <div key={day} className={cn("flex min-h-[320px] flex-col", isToday && "bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))]")}>
                <p className="border-b border-line-2 px-3 py-2 text-center">
                  <span className="block text-[11.5px] font-semibold capitalize text-fg-3">{label(day, { weekday: "short" })}</span>
                  <span className={cn("mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[13.5px] font-bold", isToday && "bg-accent text-white")}>{label(day, { day: "numeric" })}</span>
                </p>
                <ul className="flex flex-1 flex-col gap-1.5 p-2">
                  {list.length === 0 && <li className="mt-6 text-center text-[11.5px] text-fg-3">Libre</li>}
                  {list.map((item) => {
                    const type = ACTIVITY_TYPES[item.type];
                    const Icon = type.icon;
                    const done = item.status === "completada";
                    return (
                      <li key={item.code}>
                        <Link
                          href={activityHref(item.code)}
                          style={toneStyle(item.bucket === "overdue" ? "bad" : type.tone)}
                          className={cn(
                            "lift block rounded-[10px] border-l-[3px] border-[var(--tint)] px-2.5 py-2 text-[12px] transition hover:shadow-[0_10px_20px_-14px_var(--tint)]",
                            done ? "bg-surface-2 text-fg-3" : "bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))]",
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[var(--tint)]">
                            <Icon size={12} />
                            {hour(item.due_at)}
                          </span>
                          <b className={cn("mt-0.5 line-clamp-2 font-semibold text-fg", done && "text-fg-3 line-through decoration-fg-3/40")}>{item.subject}</b>
                          <span className="mt-0.5 block truncate text-[11px] text-fg-3">{item.related ? item.related.name : shortName(item.owner.name)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
