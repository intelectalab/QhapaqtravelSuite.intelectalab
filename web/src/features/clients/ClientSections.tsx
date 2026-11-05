import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import type { ClientDetail, ClientQuote, ClientTrip, TripDay } from "@/lib/clients";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";

const DAY_STYLE: Record<TripDay["state"], string> = {
  done: "bg-t4/15 text-t4",
  today: "bg-t4 text-white",
  risk: "bg-bad/10 text-bad outline-dashed outline-[1.5px] outline-bad/50",
  upcoming: "bg-surface-2 text-fg-3",
};

export function CurrentTrip({ current }: { current: NonNullable<ClientDetail["currentTrip"]> }) {
  const { trip, days, incident } = current;
  return (
    <div className="lift rounded-[14px] border border-line p-4 hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/reservas/${trip.id}`} className="text-[15px] font-semibold hover:underline">
            {trip.title}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {trip.id} · {formatDate(trip.from)} al {formatDate(trip.to)} · {trip.passengers.join(" y ")}
          </p>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => (
          <span key={day.date} className={cn("grid h-[34px] place-items-center rounded-lg font-mono text-[11px] font-semibold uppercase", DAY_STYLE[day.state])}>
            {day.state === "today" ? "Hoy" : formatDate(day.date).replace(/ \d{4}$/, "")}
          </span>
        ))}
      </div>
      {incident && (
        <div className="mt-3 flex items-center gap-2.5 rounded-[11px] bg-bad/[0.07] px-3 py-2.5 text-[13px]">
          <TriangleAlert size={17} strokeWidth={2} className="flex-none text-bad" />
          <span className="min-w-0 flex-1">{incident.title}</span>
          <Link href={`/operaciones/incidencias/${incident.id}`} className="font-semibold text-bad">
            Ver incidencia
          </Link>
        </div>
      )}
    </div>
  );
}

function ListRow({ href, title, detail, aside }: { href: string; title: string; detail: string; aside: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <span className="min-w-0 flex-1">
        <Link href={href} className="block truncate font-semibold hover:underline">
          {title}
        </Link>
        <span className="block truncate text-[12.5px] text-fg-3">{detail}</span>
      </span>
      {aside}
    </li>
  );
}

export function TripList({ trips }: { trips: ClientTrip[] }) {
  if (trips.length === 0) return <p className="py-6 text-center text-[13px] text-fg-3">Aún no tiene viajes con tu agencia.</p>;
  return (
    <ul>
      {trips.map((trip) => (
        <ListRow
          key={trip.id}
          href={`/reservas/${trip.id}`}
          title={trip.title}
          detail={`${trip.id} · ${formatDate(trip.from)} al ${formatDate(trip.to)} · ${formatMoney(trip.totalPen)}`}
          aside={<StatusBadge status={trip.status} />}
        />
      ))}
    </ul>
  );
}

export function QuoteList({ quotes }: { quotes: ClientQuote[] }) {
  if (quotes.length === 0) return <p className="py-6 text-center text-[13px] text-fg-3">No tiene cotizaciones.</p>;
  return (
    <ul>
      {quotes.map((quote) => (
        <ListRow key={quote.id} href={`/cotizaciones/${quote.id}`} title={quote.title} detail={`${quote.id} · válida hasta el ${formatDate(quote.validUntil)}`} aside={<StatusBadge status={quote.status} />} />
      ))}
    </ul>
  );
}

