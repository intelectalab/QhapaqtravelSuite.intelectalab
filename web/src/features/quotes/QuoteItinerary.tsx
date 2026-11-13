import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { QuoteItineraryBlock } from "@/lib/quotes";

export function QuoteItinerary({ blocks, empty = "Los productos de esta versión no tienen itinerario cargado.", linked = true }: { blocks: QuoteItineraryBlock[]; empty?: string; linked?: boolean }) {
  if (blocks.length === 0) return <p className="text-[13.5px] text-fg-3">{empty}</p>;

  return (
    <ol className="flex flex-col gap-3">
      {blocks.map((block) => (
        <li key={block.product.code}>
          <p className="mb-1 text-[13.5px] font-semibold">
            {linked ? (
              <Link href={`/catalogo/productos/${block.product.code}`} className="hover:underline">
                {block.product.name}
              </Link>
            ) : (
              block.product.name
            )}
            {block.start && <span className="ml-2 text-[12px] font-normal text-fg-3">desde el {formatDate(block.start)}</span>}
          </p>
          {block.days.length > 0 ? (
            <ul className="ml-1 flex flex-col border-l-2 border-[color-mix(in_srgb,var(--tint,var(--t1))_30%,transparent)] pl-3">
              {block.days.map((day) => (
                <li key={day.day} className="py-0.5 text-[13px] text-fg-2">
                  <b className="mr-1.5 font-semibold text-fg">Día {day.day}</b>
                  {day.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-fg-3">Sin itinerario por días.</p>
          )}
        </li>
      ))}
    </ol>
  );
}
