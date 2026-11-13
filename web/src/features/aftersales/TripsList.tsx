"use client";

import { PlaneLanding } from "lucide-react";
import Link from "next/link";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivityCreateAction } from "@/features/activities/ActivityForms";
import { useAdvisorRows } from "@/features/crm/AdvisorFilter";
import type { RelatedOptions } from "@/lib/activities";
import type { AfterSalesOverview, TripItem } from "@/lib/aftersales";
import { formatDate, formatMoney, TIME_ZONE } from "@/lib/format";
import { SurveyAction } from "./AfterSalesForms";
import { ScoreBadge } from "./AfterSalesTables";

const callDefaults = (trip: TripItem) => ({
  type: "postventa",
  subject: `Llamada de postventa · ${trip.code} ${trip.client.name}`,
  due_at: `${new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE })}T17:00`,
});

export function TripsList({ overview, options }: { overview: AfterSalesOverview; options: RelatedOptions | null }) {
  const trips = useAdvisorRows(overview.trips, overview.owners, (trip) => trip.owner_id);

  if (trips.length === 0) return <EmptyState icon={<PlaneLanding size={20} />} title="No hay viajes por cerrar" description="Cuando un viaje termine aparecerá aquí para registrar la encuesta." />;

  return (
    <ul className="grid gap-2.5 md:grid-cols-2">
      {trips.map((trip, index) => (
        <li key={trip.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-3 rounded-tile border border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/reservas/${trip.code}`} className="block truncate text-[13.5px] font-semibold hover:text-accent">
              {trip.title}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
              <span>{trip.client.name}</span>
              <span>{formatDate(trip.travel_to)}</span>
              <span>{formatMoney(trip.total, trip.currency)}</span>
              {trip.status === "en_operacion" ? <LiveTag>De viaje</LiveTag> : <StatusBadge status={trip.status} />}
            </p>
          </div>
          <span className="flex items-center gap-1.5">
            {options && overview.can.manage && <ActivityCreateAction options={options} preset={{ type: "client", code: trip.client.code, name: trip.client.name }} defaults={callDefaults(trip)} formKey={`postventa-${trip.code}`} title="Programar llamada de postventa" label="Llamar" size="sm" variant="secondary" />}
            {trip.survey ? <ScoreBadge score={trip.survey.score} category={trip.survey.score >= 9 ? "promotor" : trip.survey.score >= 7 ? "pasivo" : "detractor"} /> : overview.can.manage ? <SurveyAction overview={overview} trip={trip} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
