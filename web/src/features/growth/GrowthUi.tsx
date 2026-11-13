import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { toneOf } from "@/lib/growth";

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <Badge tone={toneOf(status)} dot={false}>
      {label}
    </Badge>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</section>;
}

export function PlanNotice({ enabled, feature }: { enabled: boolean; feature: string }) {
  if (enabled) return null;
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--sun)_12%,var(--surface))] px-4 py-3 text-[13px] text-fg-2">
      <Lock size={15} className="flex-none" />
      {feature} no está activo en el plan de la agencia. Puedes revisar lo registrado, pero los cambios quedan bloqueados hasta activarlo en Reglas o mejorar el plan.
    </p>
  );
}

export function Pct({ value }: { value: string | number }) {
  const number = Number(value);
  return (
    <span className={number > 0 ? "font-semibold text-ok" : number < 0 ? "font-semibold text-bad" : "text-fg-3"}>
      {number > 0 ? "+" : ""}
      {number.toLocaleString("es-PE", { maximumFractionDigits: 2 })} %
    </span>
  );
}
