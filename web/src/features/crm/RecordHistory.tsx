import { History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { RecordEvent } from "@/lib/history";

const ACTIONS: Record<string, string> = {
  crear: "creó",
  editar: "editó",
  asignar: "asignó",
  reasignar: "reasignó",
  tomar_lead: "tomó el lead",
  cambio_estado: "cambió el estado",
  calificar: "calificó",
  descartar: "descartó",
  convertir: "convirtió",
  reabrir: "reabrió",
  fusionar: "fusionó",
  marcar_duplicado: "marcó como duplicado",
  primer_contacto: "registró el primer contacto",
  cambio_etapa: "movió de etapa",
  completar: "completó",
  reprogramar: "reprogramó",
  eliminar: "eliminó",
};

const DOT: Record<string, string> = { Lead: "bg-violet", Oportunidad: "bg-info", Actividad: "bg-t1", Cotización: "bg-t4" };

const actionLabel = (action: string) => ACTIONS[action] ?? action.replaceAll("_", " ");

export function RecordHistory({ events, current, title = "Historial", empty = "Sin cambios desde que se creó.", translate }: { events: RecordEvent[]; current: string; title?: string; empty?: string; translate?: (value: string) => string }) {
  const show = (value: string | null) => {
    if (!value) return value;
    const dated = value.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g, (iso) => formatDateTime(iso, false));
    return translate ? translate(dated) : dated;
  };

  return (
    <Card>
      <TintCardTitle icon={History} title={title} />
      {events.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">{empty}</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event) => (
            <li key={event.id} className="group flex gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2">
              <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full transition-transform duration-300 group-hover:scale-150", DOT[event.entity] ?? "bg-fg-3")} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <b className="font-semibold">{event.actor ?? "Sistema"}</b> <span className="text-fg-2">{actionLabel(event.action)}</span>
                  {event.entity_id !== current && <span className="ml-1 font-mono text-[12px] text-fg-3">{event.entity_id}</span>}
                </p>
                {(event.before || event.after) && event.action !== "crear" && (
                  <p className="mt-0.5 truncate text-[12px] text-fg-3" title={`${show(event.before) ?? "—"} → ${show(event.after) ?? "—"}`}>
                    {event.before && <span className="line-through decoration-fg-3/50">{show(event.before)}</span>}
                    {event.before && event.after ? " → " : null}
                    {show(event.after)}
                  </p>
                )}
                {event.action === "crear" && event.after && <p className="mt-0.5 truncate text-[12px] text-fg-3">{event.after}</p>}
              </div>
              <span className="flex-none self-start font-mono text-[11.5px] text-fg-3">{formatDateTime(event.occurred_at, false)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
