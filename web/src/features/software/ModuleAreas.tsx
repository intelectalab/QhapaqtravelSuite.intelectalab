import type { CSSProperties } from "react";
import { TintIcon } from "@/components/ui/Tinted";
import type { NavGroup } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { motifTile } from "@/lib/motifs";
import type { ModuleArea } from "@/lib/software";
import { toneStyle } from "@/lib/tone";
import { Reveal } from "./Reveal";

function motifStyle(group: NavGroup): CSSProperties | undefined {
  const tile = motifTile(group.motif);
  if (!tile) return undefined;
  return { WebkitMaskImage: tile.image, maskImage: tile.image, WebkitMaskSize: tile.size, maskSize: tile.size };
}

function GroupMotif({ group }: { group: NavGroup }) {
  const style = motifStyle(group);
  return (
    <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 opacity-[0.08] transition-[opacity,transform] duration-700 group-hover:rotate-6 group-hover:opacity-[0.16]">
      {style ? <span className="absolute inset-0 bg-[var(--tint)]" style={style} /> : <span className="weave-tint absolute inset-0 [background:var(--tint)] [mask-size:28px_28px]" />}
    </span>
  );
}

export function AreaCard({ area, detailed = false, index }: { area: ModuleArea; detailed?: boolean; index: number }) {
  const screens = area.groups.flatMap((group) => group.screens);
  const lead = area.groups[0];

  return (
    <Reveal delay={index * 70} className="h-full">
      <article style={toneStyle(area.tone)} className="lift group relative isolate flex h-full flex-col overflow-hidden rounded-card border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-6 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]">
        {lead && <GroupMotif group={lead} />}
        <div className="flex items-center gap-3">
          <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-[14px] bg-[var(--tint)] text-white shadow-[0_10px_22px_-12px_var(--tint)]">
            <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:16px_16px] opacity-[0.16] transition-[background-position] duration-700 group-hover:bg-[position:8px_8px]" />
            {lead && <lead.icon size={21} className="relative transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />}
          </span>
          <div>
            <h3 className="text-[18px] font-bold tracking-tight text-fg">{area.title}</h3>
            <p className="text-[12.5px] font-medium text-[var(--tint)]">{screens.length} pantallas</p>
          </div>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-fg-2">{area.pitch}</p>
        {detailed ? (
          <div className="mt-5 grid gap-4">
            {area.groups.map((group) => (
              <div key={group.id}>
                <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-fg">
                  <group.icon size={14} className="text-[var(--tint)]" />
                  {group.label}
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {group.screens.map((screen) => (
                    <li key={screen.href} className="group/screen flex items-center gap-2 rounded-[10px] bg-surface/70 px-2.5 py-2 text-[13px] text-fg-2 transition hover:translate-x-0.5 hover:bg-surface hover:text-fg">
                      <TintIcon icon={screen.icon} size="sm" />
                      <span className="min-w-0 truncate">{screen.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {screens.slice(0, 6).map((screen) => (
              <li key={screen.href} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-fg-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:text-[var(--tint)] hover:ring-[color-mix(in_srgb,var(--tint)_40%,transparent)]">
                <screen.icon size={12} />
                {screen.label}
              </li>
            ))}
            {screens.length > 6 && (
              <li title={screens.slice(6).map((screen) => screen.label).join(" · ")} className="inline-flex cursor-default items-center rounded-full bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-2.5 py-1 text-[12px] font-semibold text-[var(--tint)]">
                +{screens.length - 6} más
              </li>
            )}
          </ul>
        )}
      </article>
    </Reveal>
  );
}

export function ModuleAreas({ areas, detailed = false, className }: { areas: ModuleArea[]; detailed?: boolean; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", detailed ? "xl:grid-cols-2" : "lg:grid-cols-3", className)}>
      {areas.map((area, index) => (
        <AreaCard key={area.id} area={area} detailed={detailed} index={index} />
      ))}
    </div>
  );
}
