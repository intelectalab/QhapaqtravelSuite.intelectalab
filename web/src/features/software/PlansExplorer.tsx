"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { featuredPlan, maxSaving, type BillingCycle, type PlansCatalog } from "@/lib/software";
import { CycleToggle, PlanCard } from "./PlanCards";
import { PlanMatrix } from "./PlanMatrix";

interface PlansExplorerProps {
  catalog: PlansCatalog;
  initialCycle?: BillingCycle;
  withMatrix?: boolean;
  compact?: boolean;
}

export function PlansExplorer({ catalog, initialCycle = "month", withMatrix = false, compact = false }: PlansExplorerProps) {
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const featured = featuredPlan(catalog.plans);

  return (
    <div>
      <div className="mb-8 flex justify-center sm:mb-10">
        <CycleToggle cycle={cycle} onChange={setCycle} saving={maxSaving(catalog.plans)} />
      </div>
      <div className={cn("grid items-stretch gap-5", catalog.plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {catalog.plans.map((plan, index) => (
          <PlanCard key={plan.code} plan={plan} cycle={cycle} featured={plan.code === featured?.code} index={index} compact={compact} />
        ))}
      </div>
      {withMatrix && (
        <div id="comparar" className="mt-20 scroll-mt-24 rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
          <h2 className="site-display text-[26px] font-bold tracking-[-0.03em] text-fg sm:text-[32px]">Comparación completa</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-fg-2">Funciones, límites, reglas de reserva y adicionales de cada plan. Pasa el cursor sobre una columna para seguirla.</p>
          <div className="mt-4">
            <PlanMatrix catalog={catalog} cycle={cycle} />
          </div>
        </div>
      )}
    </div>
  );
}
