import { ChevronRight, CircleCheck, CircleSlash, Copy, Inbox, PhoneCall, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { InfoTip } from "@/components/ui/InfoTip";
import type { LeadRow, LeadStatus } from "@/lib/leads";

interface Stage {
  status: LeadStatus;
  label: string;
  icon: LucideIcon;
  tone: string;
}

const PATH: Stage[] = [
  { status: "nuevo", label: "Nuevo", icon: Inbox, tone: "var(--t1)" },
  { status: "contactado", label: "Contactado", icon: PhoneCall, tone: "var(--t2)" },
  { status: "calificado", label: "Calificado", icon: Star, tone: "var(--t4)" },
  { status: "convertido", label: "Convertido", icon: CircleCheck, tone: "var(--ok)" },
];

const EXITS: Stage[] = [
  { status: "descartado", label: "Descartados", icon: CircleSlash, tone: "var(--mute)" },
  { status: "duplicado", label: "Duplicados", icon: Copy, tone: "var(--mute)" },
];

function Pill({ stage, count, note, delay }: { stage: Stage; count: number; note?: string; delay: number }) {
  return (
    <span className="lift inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 text-[12.5px]" style={{ animationDelay: `${delay}ms` }}>
      <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: stage.tone }}>
        <stage.icon size={13} />
      </span>
      <span className="font-medium">{stage.label}</span>
      <b className="font-mono text-[12.5px]" style={{ color: stage.tone }}>{count}</b>
      {note && <span className="text-[11.5px] text-fg-3">{note}</span>}
    </span>
  );
}

export function LeadJourney({ leads }: { leads: LeadRow[] }) {
  const count = (status: LeadStatus) => leads.filter((lead) => lead.status === status).length;
  const unowned = leads.filter((lead) => lead.status === "nuevo" && !lead.owner_id).length;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Recorrido del lead">
        {PATH.map((stage, index) => (
          <li key={stage.status} className="flex items-center gap-1.5">
            <Pill stage={stage} count={count(stage.status)} note={stage.status === "nuevo" && unowned > 0 ? `${unowned} sin responsable` : undefined} delay={index * 60} />
            {index < PATH.length - 1 && <ChevronRight size={14} className="text-fg-3" />}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-1.5 border-l border-line pl-5">
        <span className="flex items-center gap-1 text-[12px] font-medium text-fg-3">
          Salidas
          <InfoTip label="Salidas del recorrido">Descartado: no sigue, con motivo. Duplicado: el correo o el teléfono ya estaban en otro lead o cliente. Los dos se pueden reabrir. Los duplicados no cuentan para la conversión.</InfoTip>
        </span>
        {EXITS.map((stage, index) => (
          <Pill key={stage.status} stage={stage} count={count(stage.status)} delay={(PATH.length + index) * 60} />
        ))}
      </div>
    </div>
  );
}
