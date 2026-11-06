import { ArrowRight, Briefcase, CalendarCheck, ClipboardList, FileText, HandCoins, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { FlowStage, ProcessMapData } from "@/lib/reports";
import { toneStyle, type Tone } from "@/lib/tone";

const META: Record<string, { icon: LucideIcon; tone: Tone }> = {
  lead: { icon: Sparkles, tone: "info" },
  opportunity: { icon: Briefcase, tone: "violet" },
  quote: { icon: FileText, tone: "t3" },
  reservation: { icon: CalendarCheck, tone: "ok" },
  operation: { icon: ClipboardList, tone: "t4" },
  collection: { icon: HandCoins, tone: "sun" },
};

function StageCard({ stage, index }: { stage: FlowStage; index: number }) {
  const meta = META[stage.id] ?? { icon: Sparkles, tone: "mute" as Tone };
  const Icon = meta.icon;
  return (
    <Link
      href={stage.href}
      style={{ ...toneStyle(meta.tone), animationDelay: `${index * 110}ms` }}
      className="lift group relative flex h-full animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-4 hover:border-[color-mix(in_srgb,var(--tint)_50%,transparent)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={19} />
        </span>
        <span className="font-mono text-[11px] font-semibold text-fg-3">0{index + 1}</span>
      </div>
      <p className="mt-3 text-[14.5px] font-semibold">{stage.title}</p>
      <p className="text-[12px] leading-snug text-fg-3">{stage.description}</p>
      <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-[var(--tint)]">{stage.value}</p>
      <p className="text-[12px] text-fg-2">{stage.value_label}{stage.amount !== undefined ? ` · ${formatMoney(stage.amount, "PEN", { compact: true })}` : ""}</p>
      <dl className="mt-3 flex flex-col gap-1 border-t border-[color-mix(in_srgb,var(--tint)_18%,transparent)] pt-2.5">
        {stage.facts.map((fact) => (
          <div key={fact.label} className="flex justify-between text-[12.5px]">
            <dt className="text-fg-3">{fact.label}</dt>
            <dd className="font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {stage.alert && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] px-2.5 py-1.5 text-[11.5px] font-medium text-warn">
          <TriangleAlert size={13} /> {stage.alert}
        </p>
      )}
      <span className="mt-auto flex items-center gap-1 pt-3 text-[12.5px] font-semibold text-[var(--tint)] opacity-70 transition-[opacity,gap] group-hover:gap-2 group-hover:opacity-100">
        Abrir módulo <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function Connector({ label }: { label: string | null }) {
  return (
    <div aria-hidden className="relative hidden items-center justify-center xl:flex">
      <span className="h-[2px] w-full bg-[repeating-linear-gradient(90deg,var(--line)_0_6px,transparent_6px_10px)]" />
      <span className="absolute grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-fg-3 shadow-card">
        <ArrowRight size={14} />
      </span>
      {label && <span className="absolute top-[calc(50%+18px)] whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-fg-2">{label}</span>}
    </div>
  );
}

export function ProcessFlow({ data }: { data: ProcessMapData }) {
  const rates: (string | null)[] = [
    `${data.conversion.lead_to_opportunity} %`,
    data.conversion.opportunity_win !== null ? `${data.conversion.opportunity_win} %` : null,
    data.conversion.quote_to_reservation !== null ? `${data.conversion.quote_to_reservation} %` : null,
    null,
    null,
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr)_28px)_minmax(0,1fr)] xl:gap-1.5">
      {data.stages.map((stage, index) => (
        <div key={stage.id} className="contents">
          <StageCard stage={stage} index={index} />
          {index < data.stages.length - 1 && <Connector label={rates[index]} />}
        </div>
      ))}
    </div>
  );
}
