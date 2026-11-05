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

      <div className="grid gap-3.5 md:grid-cols-2">
        <ClosedList title="Ganadas" tone="ok" icon={<CircleCheckBig size={16} />} items={won} />
        <ClosedList title="Perdidas" tone="mute" icon={<CircleX size={16} />} items={lost} />
      </div>
    </div>
  );
}

function ClosedList({ title, tone, icon, items }: { title: string; tone: "ok" | "mute"; icon: React.ReactNode; items: OpportunityItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amount_pen, 0);
  return (
    <section style={toneStyle(tone)} className="rounded-card border border-line bg-surface p-4 shadow-card">
      <header className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">{icon}</span>
        <h2 className="text-[14px] font-bold">{title}</h2>
        <span className="ml-auto text-[13px] font-semibold text-fg-2">
          {items.length} · {formatMoney(total, "PEN", { compact: true })}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="py-2 text-[12.5px] text-fg-3">Ninguna todavía.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.code} className="border-t border-line-2 first:border-t-0">
              <Link href={`/crm/oportunidades/${item.code}`} className="flex items-center gap-3 py-2 text-[13px] hover:text-[var(--tint)]">
                <span className="min-w-0 flex-1 truncate font-medium">{item.client.name}</span>
                <span className="font-mono text-[12.5px]">{formatMoney(item.amount, item.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
