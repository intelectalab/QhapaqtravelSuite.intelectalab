"use client";

import { SearchX } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { ToneScope } from "@/components/ui/Tinted";
import { AdvisorFilter, advisorsOf } from "@/features/crm/AdvisorFilter";
import { ACTIVITY_TYPES, BUCKETS, type ActivityItem, type ActivityType, type RelatedOptions } from "@/lib/activities";
import { useAdvisorFilter } from "@/lib/useAdvisorFilter";
import { ActivityRow } from "./ActivityRow";
import { ActivityWeek } from "./ActivityWeek";

export function ActivityAgenda({ items, options, week }: { items: ActivityItem[]; options: RelatedOptions | null; week: { start: string; today: string; basePath: string } | null }) {
  const [type, setType] = useState("");
  const [advisor, setAdvisor] = useAdvisorFilter();
  const advisors = advisorsOf(items, (item) => item.owner);
  const activeAdvisor = advisors.some((item) => item.id === advisor) ? advisor : "";
  const shown = items.filter((item) => (!type || item.type === type) && (!activeAdvisor || item.owner.id === activeAdvisor));
  const types = [...new Set(items.map((item) => item.type))] as ActivityType[];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select variant="chip" value={type} onChange={setType} options={[{ value: "", label: "Tipo: todos" }, ...types.map((value) => ({ value, label: ACTIVITY_TYPES[value].label }))]} ariaLabel="Filtrar por tipo" testId="filter:type" />
        <AdvisorFilter advisors={advisors} value={activeAdvisor} onChange={setAdvisor} />
        {(type || activeAdvisor) && <span className="text-[12.5px] text-fg-3">{shown.length === 1 ? "1 actividad" : `${shown.length} actividades`}</span>}
      </div>
      {week ? (
        <ActivityWeek items={shown} start={week.start} today={week.today} basePath={week.basePath} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<SearchX size={20} />} title="No hay actividades con esos filtros" />
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKETS.map((bucket) => {
            const rows = shown.filter((item) => item.bucket === bucket.id);
            if (rows.length === 0) return null;
            return (
              <ToneScope key={bucket.id} tone={bucket.tone}>
                <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                  <header className="flex items-center gap-2.5 border-b border-line bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" />
                    <h2 className="text-[13.5px] font-bold">{bucket.title}</h2>
                    {(bucket.id === "later" || bucket.id === "done") && <span className="text-[12.5px] text-fg-3">{rows.length}</span>}
                  </header>
                  <ul>
                    {(bucket.id === "done" ? [...rows].reverse() : rows).map((item) => (
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
