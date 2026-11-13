import { ArrowRight, Database, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import { formatBytes, type PlanSummary, type TenantSummary } from "@/lib/platform";

const GB = 1024 ** 3;

export function TenantsKpis({ tenants, plans }: { tenants: TenantSummary[]; plans: PlanSummary[] }) {
  const live = tenants.filter((tenant) => tenant.status !== "suspendido");
  const users = tenants.reduce((sum, tenant) => sum + tenant.users, 0);
  const monthly = tenants.filter((tenant) => tenant.status === "activo").reduce((sum, tenant) => sum + Number(tenant.mrr), 0);
  const used = tenants.reduce((sum, tenant) => sum + tenant.storage_used_bytes, 0);
  const limits = new Map(plans.map((plan) => [plan.code, plan.limits.storage_gb ?? null]));
  const contracted = live.reduce((sum, tenant) => sum + (tenant.plan ? (limits.get(tenant.plan.code) ?? 0) : 0), 0);
  const unlimited = live.some((tenant) => tenant.plan && limits.has(tenant.plan.code) && limits.get(tenant.plan.code) === null);
  const pct = contracted > 0 ? Math.min(100, Math.round((used / (contracted * GB)) * 100)) : null;

  return (
    <section aria-label="Resumen de agencias" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <TintTile icon={Users} tone="info" label="Usuarios en plataforma" value={formatNumber(users)} note={tenants.length > 0 ? `${formatNumber(Math.round((users / tenants.length) * 10) / 10)} por agencia en promedio` : undefined} info="Suma los usuarios activos de todas las agencias, sin contar los eliminados." />
      <TintTile icon={TrendingUp} tone="ok" label="Ingreso mensual" value={formatMoney(monthly)} note={`${formatMoney(monthly * 12)} al año`} info="Suma el precio mensual vigente de las agencias activas, sin IGV. El ingreso anual es ese monto por doce." />
      <TintTile icon={Database} tone="sun" label="Almacenamiento usado" value={formatBytes(used)} note={contracted > 0 ? `de ${formatNumber(contracted)} GB contratados${unlimited ? " y planes ilimitados" : ""}${pct !== null ? ` · ${pct} %` : ""}` : unlimited ? "Planes sin límite de almacenamiento" : undefined} info="Lo usado sale del contador de archivos de cada agencia. Lo contratado suma el límite de almacenamiento del plan de las agencias activas y en prueba." />
    </section>
  );
}

export function PlanCards({ tenants, plans, current }: { tenants: TenantSummary[]; plans: PlanSummary[]; current?: string }) {
  const visible = plans.filter((plan) => plan.status !== "retired");
  if (visible.length === 0) return null;
  return (
    <section aria-label="Agencias por plan" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visible.map((plan, index) => {
        const count = tenants.filter((tenant) => tenant.plan?.code === plan.code && tenant.status !== "suspendido").length;
        const selected = current === plan.name;
        return (
          <div key={plan.code} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
            <Card className={cn("lift flex h-full flex-col gap-2", selected && "ring-2 ring-accent/40")}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <span className="font-mono text-[13px] text-fg-2">{formatMoney(Number(plan.price_month))}<span className="text-fg-3"> / mes</span></span>
              </div>
              <p className="text-[12.5px] text-fg-3">
                {plan.limits.users == null ? "Usuarios ilimitados" : `Hasta ${plan.limits.users} usuarios`} · {plan.limits.storage_gb == null ? "almacenamiento ilimitado" : `${plan.limits.storage_gb} GB`} · {plan.module_count} módulos
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-2 pt-2 text-[12.5px]">
                <span className="text-fg-2">{count === 1 ? "1 agencia" : `${count} agencias`}</span>
                <Link href={selected ? "/plataforma/agencias" : `/plataforma/agencias?plan=${encodeURIComponent(plan.name)}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                  {selected ? "Ver todas" : "Ver agencias"}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </Card>
          </div>
        );
      })}
    </section>
  );
}
