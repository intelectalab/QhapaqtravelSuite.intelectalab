import { CalendarCheck, Merge } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, RELATION_LABEL, type ActivityItem, type RelatedOptions } from "@/lib/activities";
import { formatDateTime, shortName } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { ActivityRowActions } from "./ActivityForms";

export const activityHref = (code: string) => `/crm/actividades/${encodeURIComponent(code)}`;

export function ActivityRow({ activity, options, showRelation = true }: { activity: ActivityItem; options: RelatedOptions | null; showRelation?: boolean }) {
  const type = ACTIVITY_TYPES[activity.type];
  const Icon = type.icon;
  const done = activity.status === "completada";

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line-2 px-4 py-3 transition-colors first:border-t-0 hover:bg-surface-2/60">
      <span style={toneStyle(type.tone)} className={cn("grid h-9 w-9 flex-none place-items-center rounded-[10px] transition-transform duration-300 hover:-rotate-6", done ? "bg-surface-2 text-fg-3" : "bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]")}>
        <Icon size={17} />
      </span>
      <div className="min-w-[200px] flex-1">
        <Link href={activityHref(activity.code)} className={cn("text-[13.5px] font-semibold hover:underline", done && "text-fg-2 line-through decoration-fg-3/40")}>
          {activity.subject}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
          <span>{type.label}</span>
          {showRelation && activity.related && (
            <Link href={activity.related.href} className="font-medium text-accent hover:underline">
              {RELATION_LABEL[activity.related.type]} · {activity.related.name}
            </Link>
          )}
          {activity.merged && (
            <span className="inline-flex items-center gap-1">
              <Merge size={12} />
              Vino de una fusión
            </span>
          )}
        </p>
        {done && activity.result && <p className="mt-1 text-[12.5px] text-fg-2">{activity.result}</p>}
      </div>
      <span className={cn("text-[12.5px] font-medium", activity.bucket === "overdue" ? "text-bad" : "text-fg-2")}>{formatDateTime(done && activity.completed_at ? activity.completed_at : activity.due_at, false)}</span>
      <Avatar name={activity.owner.name} size="xs" solid />
      <span className="sr-only">{shortName(activity.owner.name)}</span>
      {!done && <ActivityRowActions activity={activity} options={options} />}
    </li>
  );
}

export function RelatedActivities({ activities, options, action, empty, showRelation = true }: { activities: ActivityItem[]; options: RelatedOptions | null; action?: ReactNode; empty: string; showRelation?: boolean }) {
  const pending = activities.filter((activity) => activity.status !== "completada");
  const done = activities.filter((activity) => activity.status === "completada");

  return (
    <Card className="overflow-hidden">
      <TintCardTitle icon={CalendarCheck} title="Actividades" aside={action} />
      {activities.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">{empty}</p>
      ) : (
        <ul className="-mx-5 -mb-5">
          {[...pending, ...[...done].reverse()].map((activity) => (
            <ActivityRow key={activity.code} activity={activity} options={options} showRelation={showRelation} />
          ))}
        </ul>
      )}
    </Card>
  );
}
