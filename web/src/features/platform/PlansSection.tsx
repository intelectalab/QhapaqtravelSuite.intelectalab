import type { ReactNode } from "react";
import { TabbedCard } from "@/components/ui/RouteTabs";

export function PlansSection({ plans, rules, requests, children }: { plans: number; rules: number; requests?: number; children: ReactNode }) {
  return (
    <TabbedCard
      tabs={[
        { href: "/plataforma/planes", label: "Catálogo", count: plans },
        { href: "/plataforma/planes/reglas", label: "Reglas de reserva por plan", count: rules },
        { href: "/plataforma/planes/pedidos", label: "Pedidos de reglas", count: requests },
      ]}
    >
      {children}
    </TabbedCard>
  );
}
