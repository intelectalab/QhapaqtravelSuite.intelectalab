import { ArrowRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { SOFT_TINT, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { ActivityRowActions } from "@/features/activities/ActivityForms";
import { activityHref } from "@/features/activities/ActivityRow";
import { RecordHistory } from "@/features/crm/RecordHistory";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, RELATION_LABEL } from "@/lib/activities";
import { formatDateTime } from "@/lib/format";
import { getActivity, getRelatedOptions } from "@/lib/server/activities";

export async function generateMetadata({ params }: PageProps<"/crm/actividades/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getActivity(code)).subject };
}

export default async function ActividadPage({ params }: PageProps<"/crm/actividades/[code]">) {
  const { code } = await params;
  const [activity, options] = await Promise.all([getActivity(code), getRelatedOptions()]);
  const type = ACTIVITY_TYPES[activity.type];
  const Icon = type.icon;
  const done = activity.status === "completada";
  const chain = [
    ...(activity.previous ? [{ label: "Viene de", ...activity.previous }] : []),
    ...(activity.next ? [{ label: "Le siguió", ...activity.next }] : []),
  ];

  return (
    <ToneScope tone={done ? "ok" : activity.status === "vencida" ? "bad" : type.tone}>
      <PageHeader
        back={{ href: "/crm/actividades", label: "Actividades" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Icon size={24} />
          </span>
        }
        title={activity.subject}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={activity.status} />
          </span>
        }
        subtitle={`${activity.code} · ${type.label}`}
        actions={!done ? <ActivityRowActions activity={activity} options={options} /> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={ClipboardList} title="Detalle" />
            <FieldList
              fields={[
                { label: done ? "Programada para" : "Fecha y hora", value: formatDateTime(activity.due_at) },
                { label: "Responsable", value: activity.owner.name },
                {
                  label: "Relacionada con",
                  value: activity.related ? (
                    <Link href={activity.related.href} className="font-medium text-accent hover:underline">
                      {RELATION_LABEL[activity.related.type]} · {activity.related.name}
                    </Link>
                  ) : (
                    "Sin relación"
                  ),
                },
                ...(activity.merged_from
                  ? [{ label: "Fusión", value: <Link href={`/crm/leads/${activity.merged_from.code}`} className="hover:underline">Vino del lead {activity.merged_from.name} ({activity.merged_from.code})</Link> }]
                  : []),
                { label: "Agendada", value: `${formatDateTime(activity.created_at, false)}${activity.created_by ? ` por ${activity.created_by}` : ""}` },
                ...(done
                  ? [
                      { label: "Completada", value: `${activity.completed_at ? formatDateTime(activity.completed_at, false) : "—"}${activity.auto_closed ? " · cierre automático" : activity.completed_by ? ` por ${activity.completed_by}` : ""}` },
                      { label: "Resultado", value: activity.result ?? "—" },
                    ]
                  : []),
              ]}
            />
            {activity.description && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{activity.description}</p>}
          </Card>
          {chain.length > 0 && (
            <Card>
              <TintCardTitle icon={ArrowRight} title="Seguimiento" />
              <ul className="flex flex-col gap-2">
                {chain.map((item) => (
                  <li key={item.code}>
                    <Link href={activityHref(item.code)} className={cn("flex items-center gap-3 rounded-[12px] px-3.5 py-3 transition hover:brightness-[0.98]", SOFT_TINT)}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11.5px] font-semibold text-[var(--tint)]">{item.label}</span>
                        <b className="block truncate text-[13.5px] font-semibold">{item.subject}</b>
                        <span className="block text-xs text-fg-3">{item.code}</span>
                      </span>
                      <ArrowRight size={16} className="flex-none text-[var(--tint)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <RecordHistory events={activity.history} current={activity.code} title="Auditoría" />
      </div>
    </ToneScope>
  );
}
