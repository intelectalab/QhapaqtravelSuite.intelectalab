import { CalendarClock, CircleCheckBig, CircleX } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { OPEN_STAGES, STAGE_TONE, type OpportunityBoard, type OpportunityItem } from "@/lib/opportunities";
import { toneStyle } from "@/lib/tone";

function OpportunityCard({ item, today }: { item: OpportunityItem; today: string }) {
  const overdue = item.expected_close_date < today;
  return (
    <Link href={`/crm/oportunidades/${item.code}`} className="block rounded-[14px] border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_var(--tint)]">
      <p className="truncate text-[13.5px] font-semibold">{item.client.name}</p>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-3">{item.title}</p>
      <p className="mt-2.5 text-[17px] font-bold tracking-tight">{formatMoney(item.amount, item.currency)}</p>
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        <span className={cn("inline-flex items-center gap-1", overdue ? "font-semibold text-bad" : "text-fg-2")}>
          <CalendarClock size={13} />
          {overdue ? "Venció el " : "Cierra el "}
          {formatDate(item.expected_close_date).replace(/ \d{4}$/, "")}
        </span>
        <span className="ml-auto">
          <Avatar name={item.owner.name} size="xs" solid />
        </span>
      </div>
    </Link>
  );
}

export function PipelineBoard({ board, today }: { board: OpportunityBoard; today: string }) {
  const stages = board.stages.filter((stage) => OPEN_STAGES.includes(stage.code));
  const won = board.items.filter((item) => item.stage === "ganada");
  const lost = board.items.filter((item) => item.stage === "perdida");

  return (
    <div className="flex flex-col gap-5">
      <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[880px] grid-cols-4 gap-3.5">
          {stages.map((stage) => {
            const items = board.items.filter((item) => item.stage === stage.code);
            const weighted = items.reduce((total, item) => total + (item.amount_pen * item.probability) / 100, 0);
            return (
              <section key={stage.code} style={toneStyle(STAGE_TONE[stage.code])} className={cn("flex flex-col rounded-card p-3", SOFT_TINT)}>
                <header className="mb-3 px-1">
                  <span className="mb-2 block h-1 rounded-full bg-[var(--tint)]" />
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14px] font-bold">{stage.name}</h2>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--tint)] px-2 text-[12px] font-bold text-white">{items.length}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    {stage.probability} % · {formatMoney(weighted, "PEN", { compact: true })} ponderado
                  </p>
                </header>
                <div className="flex flex-col gap-2.5">
                  {items.length === 0 ? <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-fg-3">Sin oportunidades</p> : items.map((item) => <OpportunityCard key={item.code} item={item} today={today} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <ClosedSummary won={won} lost={lost} />
    </div>
  );
}

function ClosedSummary({ won, lost }: { won: OpportunityItem[]; lost: OpportunityItem[] }) {
  const wonTotal = won.reduce((sum, item) => sum + item.amount_pen, 0);
  const lostTotal = lost.reduce((sum, item) => sum + item.amount_pen, 0);
  const share = wonTotal + lostTotal > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 100) : 0;

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">Cerradas</h2>
          <p className="text-[12.5px] text-fg-3">Lo que se ganó y lo que se perdió, en soles.</p>
        </div>
        {wonTotal + lostTotal > 0 && (
          <div className="min-w-[240px] flex-1 sm:max-w-[380px]">
            <div className="mb-1.5 flex justify-between text-[12px] font-semibold">
              <span className="text-ok">{share} % del monto ganado</span>
              <span className="text-bad">{100 - share} % perdido</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <span className="h-full origin-left rounded-l-full bg-ok motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${share}%` }} />
              <span className="h-full origin-right rounded-r-full bg-bad/70 motion-safe:animate-[fill-x_700ms_200ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${100 - share}%` }} />
            </div>
          </div>
        )}
      </header>
      <div className="grid gap-3.5 md:grid-cols-2">
        <ClosedList title="Ganadas" tone="ok" icon={<CircleCheckBig size={18} />} items={won} total={wonTotal} />
        <ClosedList title="Perdidas" tone="bad" icon={<CircleX size={18} />} items={lost} total={lostTotal} />
      </div>
    </section>
  );
}

function ClosedList({ title, tone, icon, items, total }: { title: string; tone: "ok" | "bad"; icon: React.ReactNode; items: OpportunityItem[]; total: number }) {
  return (
    <div style={toneStyle(tone)} className={cn("lift group/closed overflow-hidden rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)]", SOFT_TINT)}>
      <header className="relative flex items-center gap-3 overflow-hidden bg-[var(--tint)] px-4 py-3 text-white">
        <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:18px_18px] opacity-[0.12] transition-[background-position] duration-700 ease-out group-hover/closed:bg-[position:9px_9px]" />
        <span className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-white/15 transition-transform duration-300 group-hover/closed:-rotate-6 group-hover/closed:scale-110">{icon}</span>
        <div className="relative min-w-0 flex-1">
          <h3 className="text-[14px] font-bold">{title}</h3>
          <p className="text-[12px] text-white/75">{items.length === 1 ? "1 oportunidad" : `${items.length} oportunidades`}</p>
        </div>
        <p className="relative text-[22px] font-bold tracking-tight">{formatMoney(total, "PEN", { compact: true })}</p>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-fg-3">Ninguna todavía.</p>
      ) : (
        <ul className="flex flex-col gap-1 p-1.5">
          {items.map((item, index) => (
            <li key={item.code} style={{ animationDelay: `${index * 60}ms` }} className="motion-safe:animate-[drop-in_300ms_ease-out_backwards]">
              <Link href={`/crm/oportunidades/${item.code}`} className="group/row relative flex items-center gap-3 overflow-hidden rounded-[11px] px-2.5 py-2 transition-[background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface hover:shadow-[0_8px_18px_-14px_var(--tint)]">
                <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-[var(--tint)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/row:scale-y-100" />
                <span className="flex-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/row:scale-110">
                  <Avatar name={item.client.name} size="sm" />
                </span>
                <span className="min-w-0 flex-1 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/row:translate-x-1">
                  <b className="block truncate text-[13px] font-semibold">{item.client.name}</b>
                  <span className="block truncate text-[12px] text-fg-3">
                    {item.title}
                    {item.closed_at && ` · ${formatDate(item.closed_at).replace(/ \d{4}$/, "")}`}
                  </span>
                </span>
                <span className="text-right">
                  <b className="block font-mono text-[13px] font-semibold">{formatMoney(item.amount, item.currency)}</b>
                  {item.currency !== "PEN" && <span className="block text-[11.5px] text-fg-3">{formatMoney(item.amount_pen, "PEN", { compact: true })}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
