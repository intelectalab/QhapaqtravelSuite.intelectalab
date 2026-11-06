import { PackagePlus } from "lucide-react";
import { planTone } from "@/lib/platform";
import type { PlansCatalog } from "@/lib/software";
import { toneStyle } from "@/lib/tone";
import { Reveal } from "./Reveal";

export function FeatureAvailability({ catalog }: { catalog: PlansCatalog }) {
  const addons = new Map(catalog.addons.map((addon) => [addon.code, addon]));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {catalog.features.map((group, index) => (
        <Reveal key={group.group} delay={(index % 3) * 70}>
          <article className="lift h-full rounded-[18px] border border-line bg-surface p-5">
            <h3 className="flex items-center justify-between text-[15px] font-bold tracking-tight text-fg">
              {group.group}
              <span className="font-mono text-[12px] font-medium text-fg-3">{group.items.length}</span>
            </h3>
            <ul className="mt-3 grid gap-2">
              {group.items.map((feature) => {
                const first = catalog.plans.find((plan) => feature.values[plan.code]);
                const addon = feature.addon ? addons.get(feature.addon) : undefined;
                const addonPlan = !first && addon ? catalog.plans.find((plan) => addon.plans[plan.code]?.status !== "unavailable") : undefined;
                const shown = first ?? addonPlan;
                return (
                  <li key={feature.key} className="group flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2">
                    <span className="min-w-0 text-[13.5px] text-fg-2 transition-colors group-hover:text-fg">{feature.label}</span>
                    {shown ? (
                      <span style={toneStyle(planTone(shown.rank))} className="inline-flex flex-none items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--tint)] transition-transform duration-300 group-hover:-translate-y-0.5">
                        {addonPlan && <PackagePlus size={12} />}
                        {addonPlan ? "Adicional" : `Desde ${shown.name}`}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </article>
        </Reveal>
      ))}
    </div>
  );
}
