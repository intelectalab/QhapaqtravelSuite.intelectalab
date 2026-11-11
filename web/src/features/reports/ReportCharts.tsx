"use client";

import { useState } from "react";
import { BarChart } from "@/components/ui/Charts";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import type { ReportChart, ReportValueFormat } from "@/lib/reports";
import { toneStyle, type Tone } from "@/lib/tone";

const PALETTE: Tone[] = ["t1", "t3", "t4", "violet", "t2", "ok", "sun", "bad"];

export function formatReportValue(value: number | string | null | undefined, format: ReportValueFormat, compact = false): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && !["money", "number", "percent", "hours", "days", "rating"].includes(format)) {
    if (format === "date") return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
    if (format === "datetime") return new Date(value).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return value;
  }
  const number = Number(value);
  switch (format) {
    case "money":
      return formatMoney(number, "PEN", { compact });
    case "percent":
      return `${number.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
    case "hours":
      return `${number.toLocaleString("es-PE", { maximumFractionDigits: 1 })} h`;
    case "days":
      return `${number.toLocaleString("es-PE", { maximumFractionDigits: 1 })} días`;
    case "rating":
      return `${number.toLocaleString("es-PE", { maximumFractionDigits: 1 })} / 5`;
    default:
      return formatNumber(number);
  }
}

function Empty() {
  return <p className="grid h-28 place-items-center text-[13px] text-fg-3">Sin datos en el periodo.</p>;
}

function HBars({ chart }: { chart: ReportChart }) {
  const max = Math.max(...chart.series.map((point) => Math.abs(point.value ?? 0)), 0) || 1;
  return (
    <ul className="flex flex-col gap-2.5">
      {chart.series.map((point, index) => (
        <li key={`${point.label}-${index}`} className="group" title={point.count !== undefined ? `${point.count} registros` : undefined}>
          <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
            <span className="truncate font-medium">{point.label}</span>
            <span className="flex-none font-mono text-fg-2">{formatReportValue(point.value ?? 0, chart.format, true)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full origin-left rounded-full bg-[var(--tint)] opacity-80 transition-opacity group-hover:opacity-100 motion-safe:animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(3, (Math.abs(point.value ?? 0) / max) * 100)}%`, animationDelay: `${index * 70}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Donut({ chart }: { chart: ReportChart }) {
  const [active, setActive] = useState<number | null>(null);
  const total = chart.series.reduce((sum, point) => sum + (point.value ?? 0), 0) || 1;
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const starts = chart.series.map((_, index) => chart.series.slice(0, index).reduce((sum, point) => sum + (point.value ?? 0) / total, 0));
  const focus = active !== null ? chart.series[active] : null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[124px] w-[124px] flex-none">
        <svg viewBox="0 0 100 100" className="-rotate-90">
          {chart.series.map((point, index) => {
            const share = (point.value ?? 0) / total;
            return (
              <circle key={`${point.label}-${index}`} cx="50" cy="50" r={radius} fill="none" strokeWidth={active === index ? 13 : 10} style={toneStyle(PALETTE[index % PALETTE.length])} stroke="var(--tint)" strokeDasharray={`${share * length} ${length}`} strokeDashoffset={-starts[index] * length} className="cursor-pointer transition-[stroke-width] duration-200" onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span>
            <b className="block font-mono text-[18px] leading-none">{focus ? formatReportValue(focus.value ?? 0, chart.format, true) : formatReportValue(total, chart.format, true)}</b>
            <span className="text-[10.5px] text-fg-3">{focus ? `${Math.round(((focus.value ?? 0) / total) * 100)} %` : "Total"}</span>
          </span>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-1.5">
        {chart.series.map((point, index) => (
          <li key={`${point.label}-${index}`} style={toneStyle(PALETTE[index % PALETTE.length])} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} className={cn("flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[12.5px] transition-colors", active === index && "bg-surface-2")}>
            <span className="h-2.5 w-2.5 flex-none rounded-full bg-[var(--tint)]" />
            <span className="min-w-0 flex-1 truncate text-fg-2">{point.label}</span>
            <b className="flex-none font-mono">{formatReportValue(point.value ?? 0, chart.format, true)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Funnel({ chart }: { chart: ReportChart }) {
  const first = chart.series[0]?.value || 1;
  return (
    <ul className="flex flex-col gap-1.5">
      {chart.series.map((point, index) => {
        const share = ((point.value ?? 0) / first) * 100;
        return (
          <li key={point.label} className="group grid grid-cols-[110px_1fr_70px] items-center gap-3 text-[12.5px]">
            <span className="truncate text-fg-2">{point.label}</span>
            <span className="flex justify-center">
              <span style={{ width: `${Math.max(6, share)}%`, animationDelay: `${index * 80}ms`, opacity: 1 - index * 0.1 }} className="block h-6 origin-center rounded-[7px] bg-[var(--tint)] transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" />
            </span>
            <span className="text-right font-mono">
              <b>{formatNumber(point.value ?? 0)}</b>
              {index > 0 && <span className="block text-[10.5px] text-fg-3">{Math.round(share)} %</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Lines({ chart }: { chart: ReportChart }) {
  const keys = Object.entries(chart.keys ?? {});
  const max = Math.max(...chart.series.flatMap((point) => keys.map(([key]) => Number(point[key] ?? 0))), 0) || 1;
  const width = 760;
  const height = 150;
  const step = chart.series.length > 1 ? width / (chart.series.length - 1) : width;
  return (
    <div>
      <svg viewBox={`-12 -8 ${width + 24} ${height + 30}`} className="h-auto w-full overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((line) => (
          <line key={line} x1="0" x2={width} y1={height - height * line} y2={height - height * line} stroke="var(--line-2)" strokeWidth="0.6" />
        ))}
        {keys.map(([key], index) => (
          <g key={key} style={toneStyle(PALETTE[index % PALETTE.length])}>
            <polyline fill="none" stroke="var(--tint)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={chart.series.map((point, position) => `${position * step},${height - (Number(point[key] ?? 0) / max) * height}`).join(" ")} />
            {chart.series.map((point, position) => (
              <circle key={position} cx={position * step} cy={height - (Number(point[key] ?? 0) / max) * height} r="4" fill="var(--surface)" stroke="var(--tint)" strokeWidth="1.6">
                <title>{`${point.label} · ${chart.keys?.[key]}: ${formatNumber(Number(point[key] ?? 0))}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {chart.series.map((point, position) => (
          <text key={point.label} x={position * step} y={height + 14} textAnchor="middle" className="fill-[var(--fg-3)] text-[11px]">
            {point.label}
          </text>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3">
        {keys.map(([key, label], index) => (
          <li key={key} style={toneStyle(PALETTE[index % PALETTE.length])} className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <span className="h-1 w-4 rounded-full bg-[var(--tint)]" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pair({ chart }: { chart: ReportChart }) {
  const max = Math.max(...chart.series.flatMap((point) => [point.value ?? 0, point.value2 ?? 0]), 0) || 1;
  const [first, second] = chart.labels ?? ["Valor", "Comparado"];
  return (
    <div>
      <div className="flex h-[150px] items-end gap-2">
        {chart.series.map((point, index) => (
          <div key={point.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${point.label} · ${first}: ${formatReportValue(point.value ?? 0, chart.format)} · ${second}: ${formatReportValue(point.value2 ?? 0, chart.format)}`}>
            <div className="flex h-full items-end justify-center gap-1">
              <span style={{ ...toneStyle("t1"), height: `${((point.value ?? 0) / max) * 100}%`, animationDelay: `${index * 60}ms` }} className="block w-1/3 max-w-[18px] origin-bottom rounded-t-[5px] bg-[var(--tint)] transition-[filter] group-hover:brightness-110 motion-safe:animate-[rise-in_600ms_ease-out_backwards]" />
              <span style={{ ...toneStyle("t3"), height: `${((point.value2 ?? 0) / max) * 100}%`, animationDelay: `${index * 60 + 30}ms` }} className="block w-1/3 max-w-[18px] origin-bottom rounded-t-[5px] bg-[var(--tint)] opacity-80 transition-[filter] group-hover:brightness-110 motion-safe:animate-[rise-in_600ms_ease-out_backwards]" />
            </div>
            <span className="mt-1.5 truncate text-center text-[10.5px] text-fg-3">{point.label}</span>
          </div>
        ))}
      </div>
      <ul className="mt-2 flex gap-3">
        {[first, second].map((label, index) => (
          <li key={label} style={toneStyle(index === 0 ? "t1" : "t3")} className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--tint)]" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportChartView({ chart, tone = "t1" }: { chart: ReportChart; tone?: Tone }) {
  const empty = chart.series.length === 0 || chart.series.every((point) => !point.value && !point.value2 && !Object.keys(chart.keys ?? {}).some((key) => Number(point[key] ?? 0) > 0));
  return (
    <div style={toneStyle(tone)}>
      {empty ? (
        <Empty />
      ) : chart.type === "hbar" ? (
        <HBars chart={chart} />
      ) : chart.type === "donut" ? (
        <Donut chart={chart} />
      ) : chart.type === "funnel" ? (
        <Funnel chart={chart} />
      ) : chart.type === "lines" ? (
        <Lines chart={chart} />
      ) : chart.type === "pair" ? (
        <Pair chart={chart} />
      ) : (
        <BarChart height={140} data={chart.series.map((point, index) => ({ label: point.label, value: Math.max(0, point.value ?? 0), caption: formatReportValue(point.value ?? 0, chart.format, true), detail: `${point.label}: ${formatReportValue(point.value ?? 0, chart.format)}${point.count !== undefined ? ` · ${point.count} registros` : ""}`, highlight: index === chart.series.length - 1 && chart.type === "line" }))} />
      )}
    </div>
  );
}
