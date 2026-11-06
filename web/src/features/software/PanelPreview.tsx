"use client";

import { CircleCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveTag } from "@/components/ui/Badge";
import { NAV_GROUPS } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { FUNNEL_STEPS, type SoftwareOverview } from "@/lib/software";
import { statusLabel, statusTone, toneColor, toneStyle, type Tone } from "@/lib/tone";

const CYCLE_MS = 2600;

function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function Kpi({ label, value, tone, delay }: { label: string; value: number; tone: Tone; delay: number }) {
  const shown = useCountUp(value);
  return (
    <div style={{ ...toneStyle(tone), animationDelay: `${delay}ms` }} className="lift group rounded-[14px] border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] p-3 animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <p className="text-[10.5px] font-semibold text-[var(--tint)]">{label}</p>
      <p className="mt-1 font-mono text-[22px] font-bold leading-none tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">{formatNumber(shown)}</p>
    </div>
  );
}

export function PanelPreview({ overview }: { overview: SoftwareOverview }) {
  const [active, setActive] = useState(0);
  const groups = NAV_GROUPS;
  const group = groups[active % groups.length];
  const step = FUNNEL_STEPS[active % FUNNEL_STEPS.length];
  const peak = Math.max(1, ...FUNNEL_STEPS.map((item) => overview.funnel[item.key]));
  const statuses = Object.entries(overview.reservations);
  const totalReservations = statuses.reduce((sum, [, count]) => sum + count, 0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((index) => index + 1), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="group/preview relative [perspective:1800px]">
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_40px_80px_-40px_rgb(14_17_32/0.55)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:[transform:rotateY(-9deg)_rotateX(3deg)] lg:group-hover/preview:[transform:none]">
        <div className="flex h-10 items-center gap-2 border-b border-line bg-surface-2 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok/70" />
          <span className="ml-3 truncate text-[11.5px] font-semibold text-fg-3">Panel de control</span>
          <span className="ml-auto">
            <LiveTag>En vivo</LiveTag>
          </span>
        </div>
        <div className="grid grid-cols-[52px_minmax(0,1fr)]">
          <aside className="relative flex flex-col items-center gap-1.5 bg-menu py-3">
            <span aria-hidden className="weave-band absolute inset-y-0 left-0 w-1" />
            {groups.map((item, index) => {
              const Icon = item.icon;
              const on = index === active % groups.length;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => setActive(index)}
                  className={cn("grid h-8 w-8 place-items-center rounded-[10px] transition-all duration-300", on ? "scale-110 bg-white/15 text-white" : "text-white/45 hover:bg-white/10 hover:text-white/80")}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </aside>
          <div className="min-w-0 p-4 sm:p-5">
            <div key={group.id} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-fg-3">Módulo</p>
              <p className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-fg">{group.label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.screens.slice(0, 3).map((screen, index) => {
                  const Icon = screen.icon;
                  return (
                    <span key={screen.href} style={{ animationDelay: `${80 + index * 70}ms` }} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-2 animate-[pop-in_380ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
                      <Icon size={11} />
                      {screen.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Kpi label="Leads" value={overview.funnel.leads} tone="t3" delay={120} />
              <Kpi label="Cotizaciones" value={overview.funnel.quotes} tone="t1" delay={200} />
              <Kpi label="Reservas" value={overview.funnel.reservations} tone="t4" delay={280} />
            </div>

            <div className="mt-4 rounded-[14px] border border-line p-3">
              <p className="mb-2.5 text-[11.5px] font-semibold text-fg">Del lead al cobro</p>
              <ul className="grid gap-1.5">
                {FUNNEL_STEPS.map((item, index) => {
                  const value = overview.funnel[item.key];
                  const on = item.key === step.key;
                  return (
                    <li key={item.key} style={toneStyle(item.tone)} className="grid grid-cols-[86px_minmax(0,1fr)_24px] items-center gap-2 text-[10.5px]">
                      <span className={cn("truncate font-medium transition-colors", on ? "text-[var(--tint)]" : "text-fg-2")}>{item.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className={cn("block h-full origin-left rounded-full bg-[var(--tint)] transition-opacity duration-300 motion-safe:animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_backwards]", on ? "opacity-100" : "opacity-60")}
                          style={{ width: `${(value / peak) * 100}%`, animationDelay: `${300 + index * 90}ms` }}
                        />
                      </span>
                      <span className="text-right font-mono font-semibold text-fg">{value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {totalReservations > 0 && (
              <div className="mt-3 rounded-[14px] border border-line p-3">
                <div className="mb-2 flex items-center justify-between text-[11.5px]">
                  <span className="font-semibold text-fg">Reservas por estado</span>
                  <span className="font-mono text-fg-3">{totalReservations}</span>
                </div>
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                  {statuses.map(([status, count], index) => (
                    <span
                      key={status}
                      title={`${statusLabel(status)}: ${count}`}
                      className="h-full origin-left transition-[filter] hover:brightness-125 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]"
                      style={{ width: `${(count / totalReservations) * 100}%`, background: toneColor(statusTone(status)), animationDelay: `${700 + index * 80}ms` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {statuses.slice(0, 4).map(([status, count]) => (
                    <span key={status} className="inline-flex items-center gap-1 text-[10.5px] text-fg-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneColor(statusTone(status)) }} />
                      {statusLabel(status)} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div key={step.key} style={toneStyle(step.tone)} className="site-toast absolute -bottom-5 left-3 flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 shadow-[0_18px_40px_-20px_rgb(14_17_32/0.5)] sm:-left-6">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--tint)] text-white">
          <step.icon size={15} />
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-semibold text-fg">{step.stage}</span>
          <span className="text-[11px] text-fg-3">{step.label} al día</span>
        </span>
        <CircleCheck size={16} className="text-ok" />
      </div>

      <div style={toneStyle("t2")} className="site-float absolute -right-2 -top-5 hidden items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-fg shadow-[0_14px_30px_-18px_rgb(14_17_32/0.5)] sm:flex">
        <ShieldCheck size={15} className="text-[var(--tint)]" />
        {overview.catalog.rules} reglas de reserva
      </div>
    </div>
  );
}
