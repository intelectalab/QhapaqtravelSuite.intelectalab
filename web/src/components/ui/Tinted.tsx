import { Check, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";
import { TILE_VARIANTS, type TileVariant } from "@/lib/tileVariants";
import { InfoTip } from "./InfoTip";
import { TileVariantSwitch } from "./TileVariant";

export const SOFT_TINT = "bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))]";

export function ToneScope({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <div style={toneStyle(tone)} className={className}>
      {children}
    </div>
  );
}

export function HeroBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("relative isolate mb-5 overflow-hidden rounded-card bg-[var(--tint)] p-6 text-white shadow-[0_18px_40px_-24px_var(--tint)] sm:p-7", className)}>
      <span aria-hidden className="weave-pattern absolute inset-0 -z-10 bg-[length:22px_22px] opacity-[0.09]" />
      <span aria-hidden className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      {children}
    </section>
  );
}

export function HeroChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-medium transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-white/25">
      {icon}
      {children}
    </span>
  );
}

export function HeroPanel({ children, className, solid = false }: { children: ReactNode; className?: string; solid?: boolean }) {
  return <div className={cn("lift rounded-[16px] p-4", solid ? "bg-surface text-fg shadow-[0_12px_30px_-18px_rgb(14_17_32/0.45)]" : "bg-white/[0.1] ring-1 ring-white/15", className)}>{children}</div>;
}

export interface JourneyStep {
  label: string;
  at: string | null;
  done: boolean;
  status?: string;
}

export function Journey({ steps, formatAt }: { steps: JourneyStep[]; formatAt: (iso: string) => string }) {
  const current = steps.findIndex((step) => !step.done);
  const delay = (index: number, base = 0) => ({ animationDelay: `${base + index * 240}ms` });

  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => {
        const next = steps[index + 1];
        const isCurrent = index === current;
        return (
          <li key={step.label} data-testid={step.status ? `status-step:${step.status}` : undefined} data-state={step.done ? "done" : isCurrent ? "current" : "todo"} className="group/step relative flex cursor-default flex-col items-center gap-1.5 text-center">
            {next && (
              <span aria-hidden className="absolute left-1/2 top-[15px] h-[3px] w-full overflow-hidden rounded-full bg-line">
                {next.done && <span className="block h-full w-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_520ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={delay(index, 180)} />}
              </span>
            )}
            <span className="relative grid h-8 w-8 place-items-center">
              {isCurrent && <span aria-hidden className="absolute inset-0 rounded-full bg-[var(--tint)] opacity-40 motion-safe:animate-ping" />}
              <span
                className={cn(
                  "relative grid h-8 w-8 place-items-center rounded-full ring-4 ring-surface transition-transform duration-300 ease-out group-hover/step:-translate-y-0.5 group-hover/step:scale-115",
                  step.done ? "bg-[var(--tint)] text-white motion-safe:animate-[pop-in_420ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]" : isCurrent ? "bg-[color-mix(in_srgb,var(--tint)_16%,var(--surface))] text-[var(--tint)]" : "bg-surface-2 text-fg-3",
                )}
                style={step.done ? delay(index) : undefined}
              >
                {step.done ? <Check size={15} strokeWidth={3} /> : <span className={cn("h-2 w-2 rounded-full bg-current", isCurrent && "motion-safe:animate-pulse")} />}
              </span>
            </span>
            <span className={cn("text-[12.5px] font-semibold transition-colors duration-200", step.done ? "text-fg" : isCurrent ? "text-[var(--tint)]" : "text-fg-3 group-hover/step:text-fg-2")}>{step.label}</span>
            <span className="text-[11.5px] text-fg-2">{step.done && step.at ? formatAt(step.at) : step.done ? "Hecho" : isCurrent ? "Siguiente" : "Pendiente"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function TintIcon({ icon: Icon, size = "md", solid = false }: { icon: LucideIcon; size?: "sm" | "md"; solid?: boolean }) {
  return (
    <span
      className={cn(
        "grid flex-none place-items-center",
        size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-[9px]",
        solid ? "bg-[var(--tint)] text-white" : "bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]",
      )}
    >
      <Icon size={size === "sm" ? 15 : 16} />
    </span>
  );
}

export function TintCardTitle({ icon, title, aside, tone }: { icon: LucideIcon; title: string; aside?: ReactNode; tone?: Tone }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold" style={tone ? toneStyle(tone) : undefined}>
        <TintIcon icon={icon} size="sm" />
        {title}
      </h3>
      {aside && <span className="text-[13px] font-semibold text-fg-3">{aside}</span>}
    </div>
  );
}

interface TintTileProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  title?: string;
  variant?: TileVariant;
  info?: ReactNode;
}

export type { TileVariant };

export function TintTile(props: TintTileProps) {
  if (props.variant) return renderTile(props.variant, props);
  return <TileVariantSwitch options={Object.fromEntries(TILE_VARIANTS.map((variant) => [variant, renderTile(variant, props)]))} />;
}

function renderTile(variant: TileVariant, { icon: Icon, label: caption, value, note, tone, title, info }: TintTileProps) {
  const style: CSSProperties | undefined = tone ? toneStyle(tone) : undefined;
  const label = info ? (
    <span className="inline-flex items-center gap-1">
      {caption}
      <InfoTip label={`De dónde sale: ${caption}`} className="h-4 w-4">
        {info}
      </InfoTip>
    </span>
  ) : (
    caption
  );
  const text = (
    <>
      <p className="text-[12.5px] font-medium text-fg-2">{label}</p>
      <div className="mt-0.5 text-[19px] font-bold tracking-tight">{value}</div>
      {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
    </>
  );

  if (variant === "side") {
    return (
      <div title={info ? undefined : title} style={style} className={cn("lift group flex items-center gap-3.5 rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] px-4 py-3.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]", SOFT_TINT)}>
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={20} />
        </span>
        <div className="min-w-0">{text}</div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div title={info ? undefined : title} style={style} className={cn("lift group rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] px-4 py-3.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]", SOFT_TINT)}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--tint)]">
          <Icon size={15} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125" />
          {label}
        </p>
        <div className="mt-1 text-[19px] font-bold tracking-tight">{value}</div>
        {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
      </div>
    );
  }

  if (variant === "watermark") {
    return (
      <div title={info ? undefined : title} style={style} className={cn("lift group relative overflow-hidden rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] px-4 py-3.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]", SOFT_TINT)}>
        <Icon aria-hidden size={76} strokeWidth={1.5} className="pointer-events-none absolute -bottom-4 -right-3 text-[var(--tint)] opacity-[0.13] transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" />
        <div className="relative pr-10">{text}</div>
      </div>
    );
  }

  if (variant === "bento-split") {
    return (
      <div title={info ? undefined : title} style={style} className="lift group grid grid-cols-[78px_minmax(0,1fr)] gap-1.5 rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] p-1.5">
        <span className="relative grid place-items-center overflow-hidden rounded-[12px] bg-[var(--tint)] text-white">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:18px_18px] opacity-[0.12]" />
          <Icon size={24} className="relative transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="rounded-[10px] bg-surface/70 px-3 py-1.5 text-[12px] font-semibold text-[var(--tint)]">{label}</p>
          <div className="flex-1 rounded-[10px] bg-surface px-3 py-2">
            <div className="text-[19px] font-bold tracking-tight">{value}</div>
            {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "bento") {
    return (
      <div title={info ? undefined : title} style={style} className="lift group grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] gap-1.5 rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] p-1.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]">
        <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[11px] bg-[var(--tint)] text-white shadow-[0_8px_16px_-10px_var(--tint)]">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:16px_16px] opacity-[0.16] transition-[background-position] duration-700 ease-out group-hover:bg-[position:8px_8px]" />
          <Icon size={18} className="relative transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-115" />
        </span>
        <p className="flex items-center rounded-[11px] bg-[color-mix(in_srgb,var(--tint)_14%,var(--surface))] px-3 text-[12px] font-semibold text-[var(--tint)] transition-colors duration-300 group-hover:bg-[color-mix(in_srgb,var(--tint)_20%,var(--surface))]">{label}</p>
        <div className="col-span-2 flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-[12px] bg-surface px-3.5 py-3">
          <div className="min-w-0 text-[19px] font-bold leading-tight tracking-tight transition-transform duration-300 group-hover:translate-x-0.5">{value}</div>
          {note && <span className="rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--tint)] transition-[transform,background-color] duration-300 group-hover:-translate-y-0.5 group-hover:bg-[color-mix(in_srgb,var(--tint)_20%,transparent)]">{note}</span>}
        </div>
      </div>
    );
  }

  if (variant === "bento-stack") {
    return (
      <div title={info ? undefined : title} style={style} className="lift group flex flex-col overflow-hidden rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-surface">
        <div className="relative flex items-center justify-between overflow-hidden bg-[var(--tint)] px-4 py-2.5 text-white">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:18px_18px] opacity-[0.1]" />
          <p className="relative text-[12.5px] font-semibold">{label}</p>
          <Icon size={17} className="relative opacity-90 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125" />
        </div>
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 px-4 py-3">
          <div className="text-[19px] font-bold tracking-tight">{value}</div>
          {note && <p className="text-right text-xs text-fg-3">{note}</p>}
        </div>
      </div>
    );
  }

  if (variant === "stripe") {
    return (
      <div title={info ? undefined : title} style={style} className="lift group relative overflow-hidden rounded-tile border border-line bg-surface py-3.5 pl-5 pr-4 shadow-card">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tint)] transition-[width] duration-300 group-hover:w-2" />
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2">
          <Icon size={15} className="text-[var(--tint)]" />
          {label}
        </p>
        <div className="mt-1 text-[19px] font-bold tracking-tight">{value}</div>
        {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
      </div>
    );
  }

  return (
    <div title={info ? undefined : title} style={style} className={cn("lift group rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] px-4 py-3.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]", SOFT_TINT)}>
      <div className="mb-2.5 w-fit transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        <TintIcon icon={Icon} solid />
      </div>
      {text}
    </div>
  );
}
