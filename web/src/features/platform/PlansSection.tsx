import type { ReactNode } from "react";
import { TabbedCard } from "@/components/ui/RouteTabs";

export function PlansSection({ plans, rules, children }: { plans: number; rules: number; children: ReactNode }) {
  return (
    <TabbedCard
      tabs={[
        { href: "/plataforma/planes", label: "Catálogo", count: plans },
        { href: "/plataforma/planes/reglas", label: "Reglas de reserva por plan", count: rules },
      ]}
    >
      {children}
    </TabbedCard>
  );
}
