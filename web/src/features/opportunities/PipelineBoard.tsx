"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CalendarClock, CircleCheckBig, CircleX, FileText, GripVertical, MoreHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";
import { moveOpportunity } from "@/app/(backoffice)/crm/oportunidades/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { Avatar } from "@/components/ui/Avatar";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { OPEN_STAGES, STAGE_TONE, type OpportunityItem, type OpportunityStage, type PipelineStage } from "@/lib/opportunities";
import { toneStyle } from "@/lib/tone";

const DRAG_TYPE = "application/x-opportunity";

function MoveMenu({ item, stages, onMove }: { item: OpportunityItem; stages: PipelineStage[]; onMove: (item: OpportunityItem, stage: OpportunityStage) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label={`Mover ${item.title}`} className="grid h-7 w-7 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
        <MoreHorizontal size={16} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[190px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-18px_rgb(14_17_32/0.45)]">
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold text-fg-3">Mover a</DropdownMenu.Label>
          {stages
            .filter((stage) => stage.code !== item.stage)
            .map((stage) => (
              <DropdownMenu.Item
                key={stage.code}
                onSelect={() => onMove(item, stage.code)}
                style={toneStyle(STAGE_TONE[stage.code])}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-surface-2"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--tint)]" />
                {stage.name}
                <span className="ml-auto text-[11.5px] text-fg-3">{stage.probability} %</span>
              </DropdownMenu.Item>
            ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link href={`/crm/oportunidades/${item.code}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-surface-2">
              Ganar o perder en la ficha
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function OpportunityCard({ item, today, stages, draggable, moving, onMove, onDragStart }: { item: OpportunityItem; today: string; stages: PipelineStage[]; draggable: boolean; moving: boolean; onMove: (item: OpportunityItem, stage: OpportunityStage) => void; onDragStart: (event: DragEvent, item: OpportunityItem) => void }) {
  const overdue = item.expected_close_date < today;
  return (
    <article
      draggable={draggable}
      onDragStart={(event) => onDragStart(event, item)}
      aria-busy={moving}
      className={cn(
        "group/card rounded-[14px] border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_var(--tint)]",
        draggable && "cursor-grab active:cursor-grabbing",
        moving && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable && <GripVertical size={15} aria-hidden className="mt-0.5 flex-none text-fg-3 opacity-0 transition group-hover/card:opacity-100" />}
        <Link href={`/crm/oportunidades/${item.code}`} draggable={false} className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold hover:underline">{item.client.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-3">{item.title}</p>
        </Link>
        {draggable && <MoveMenu item={item} stages={stages} onMove={onMove} />}
      </div>
      <p className="mt-2.5 text-[17px] font-bold tracking-tight">{formatMoney(item.amount, item.currency)}</p>
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        <span className={cn("inline-flex items-center gap-1", overdue ? "font-semibold text-bad" : "text-fg-2")}>
          <CalendarClock size={13} />
          {overdue ? "Venció el " : "Cierra el "}
          {formatDate(item.expected_close_date).replace(/ \d{4}$/, "")}
        </span>
        {(item.quotes_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-fg-3" title="Cotizaciones vinculadas">
            <FileText size={12} />
            {item.quotes_count}
          </span>
        )}
        <span className="ml-auto">
          <span title={`Responsable: ${item.owner.name}`}><Avatar name={item.owner.name} size="xs" solid /></span>
        </span>
      </div>
    </article>
  );
}

export function PipelineBoard({ items: source, stages: allStages, today }: { items: OpportunityItem[]; stages: PipelineStage[]; today: string }) {
  const canMove = useCan("crm.opportunities.manage");
  const [moved, setMoved] = useState<Record<string, { stage: OpportunityStage; probability: number }>>({});
  const [target, setTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);
  const [, startMoving] = useTransition();
  const stages = allStages.filter((stage) => OPEN_STAGES.includes(stage.code));
  const items = source.map((item) => (moved[item.code] ? { ...item, ...moved[item.code] } : item));
  const won = items.filter((item) => item.stage === "ganada");
  const lost = items.filter((item) => item.stage === "perdida");

  const move = (item: OpportunityItem, stage: OpportunityStage) => {
    if (item.stage === stage || !OPEN_STAGES.includes(item.stage)) return;
    const probability = stages.find((entry) => entry.code === stage)?.probability ?? item.probability;
    const stageName = stages.find((entry) => entry.code === stage)?.name ?? stage;
    setMoved((current) => ({ ...current, [item.code]: { stage, probability } }));
    setMoving(item.code);
    startMoving(async () => {
      const result = await moveOpportunity(item.code, stage, item.lock_version);
      setMoving(null);
      if (!result.done) {
        setMoved((current) => {
          const next = { ...current };
          delete next[item.code];
          return next;
        });
        setNotice({ tone: "bad", text: result.message ?? "No pudimos mover la oportunidad." });
        return;
      }
      setNotice(result.warnings?.length ? { tone: "warn", text: result.warnings.join(" ") } : { tone: "ok", text: `${item.title} pasó a ${stageName}.` });
    });
  };

  const dragStart = (event: DragEvent, item: OpportunityItem) => {
    event.dataTransfer.setData(DRAG_TYPE, item.code);
    event.dataTransfer.effectAllowed = "move";
  };

  const drop = (event: DragEvent, stage: OpportunityStage) => {
    event.preventDefault();
    setTarget(null);
    const code = event.dataTransfer.getData(DRAG_TYPE);
    const item = items.find((entry) => entry.code === code);
    if (item) move(item, stage);
  };

  return (
    <div className="flex flex-col gap-4">
      {(canMove || notice) && (
        <p role="status" aria-live="polite" className="text-[12.5px]">
          {notice ? (
            <span className={cn("inline-flex items-start gap-2 rounded-xl px-3 py-2", notice.tone === "ok" ? "bg-ok/10 text-ok" : notice.tone === "warn" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>
              {notice.tone !== "ok" && <TriangleAlert size={15} className="mt-0.5 flex-none" />}
              {notice.text}
            </span>
          ) : (
            <span className="text-fg-3">Arrastra una tarjeta a otra etapa o usa su menú.</span>
          )}
        </p>
      )}
      <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[880px] grid-cols-4 gap-3.5">
          {stages.map((stage) => {
            const column = items.filter((item) => item.stage === stage.code);
            const weighted = column.reduce((total, item) => total + (item.amount_pen * item.probability) / 100, 0);
            return (
              <section
                key={stage.code}
                aria-label={stage.name}
                style={toneStyle(STAGE_TONE[stage.code])}
                onDragOver={(event) => {
                  if (!canMove || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setTarget(stage.code);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
                }}
                onDrop={(event) => drop(event, stage.code)}
                className={cn("flex flex-col rounded-card p-3 transition-shadow", SOFT_TINT, target === stage.code && "shadow-[inset_0_0_0_2px_var(--tint)]")}
              >
                <header className="mb-3 px-1">
                  <span className="mb-2 block h-1 rounded-full bg-[var(--tint)]" />
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14px] font-bold">{stage.name}</h2>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--tint)] px-2 text-[12px] font-bold text-white">{column.length}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    {stage.probability} % · {formatMoney(weighted, "PEN", { compact: true })} ponderado
                  </p>
                </header>
                <div className="flex min-h-[80px] flex-col gap-2.5">
                  {column.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-fg-3">{target === stage.code ? "Suelta aquí" : "Sin oportunidades"}</p>
                  ) : (
                    column.map((item) => <OpportunityCard key={item.code} item={item} today={today} stages={stages} draggable={canMove} moving={moving === item.code} onMove={move} onDragStart={dragStart} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {won.length + lost.length > 0 && <ClosedSummary won={won} lost={lost} />}
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
