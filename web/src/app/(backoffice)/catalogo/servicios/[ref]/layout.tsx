import { Building2, CalendarClock, Coins, Users } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { SupplyAlerts, type SupplyAlert } from "@/features/catalog-shared/SupplyAlerts";
import { ServiceEditAction, ServiceToggleAction } from "@/features/catalog-services/ServiceForms";
import { SUPPLY_STATE } from "@/lib/catalog-services";
import { formatDate, formatMoney } from "@/lib/format";
import { getService } from "@/lib/server/catalog-supply";

export default async function ServicioLayout({ children, params }: { children: ReactNode; params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  if (!detail) notFound();
  const { service, provider, fx, can } = detail;
  const base = `/catalogo/servicios/${encodeURIComponent(service.ref)}`;
  const alerts: SupplyAlert[] = [
    ...(provider && provider.state !== "activo" ? [{ key: "provider", tone: "bad" as const, text: `El proveedor ${provider.name} está ${SUPPLY_STATE[provider.state].label.toLowerCase()}: el servicio no puede usarse como componente y bloquea la activación de los productos que lo incluyen.` }] : []),
    ...(service.expires_in < 0
      ? [{ key: "expired", tone: "bad" as const, text: `La vigencia terminó el ${formatDate(service.valid_to)}. Extiéndela para volver a usarlo.` }]
      : service.expires_in <= 60
        ? [{ key: "expiring", tone: "warn" as const, text: `La vigencia termina el ${formatDate(service.valid_to)} (en ${service.expires_in} días). Renueva la tarifa con el proveedor.` }]
        : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/catalogo/servicios", label: "Servicios" }}
        jump={false}
        title={service.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={SUPPLY_STATE[service.state].tone}>{SUPPLY_STATE[service.state].label}</Badge>
          </span>
        }
        subtitle={`${service.ref} · ${service.type} · ${service.provider.name}`}
        actions={
          can.manage ? (
            <>
              <ServiceToggleAction service={service} button />
              <ServiceEditAction overview={detail} service={service} button />
            </>
          ) : undefined
        }
      />
      <SupplyAlerts alerts={alerts} />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile
          icon={Coins}
          tone="t1"
          label="Costo"
          value={can.see_cost && service.cost !== null ? formatMoney(Number(service.cost), service.currency) : "Reservado"}
          note={fx ? `${formatMoney(fx.cost_pen, "PEN")} al cambio de hoy` : `por ${service.unit}`}
          info={<p>{can.see_cost ? `Costo vigente por ${service.unit} que cobra el proveedor. En dólares se convierte con el último tipo de cambio registrado en Finanzas.` : "Tu rol no ve costos de proveedor."}</p>}
        />
        <TintTile
          icon={CalendarClock}
          tone={service.expires_in < 0 ? "bad" : service.expires_in <= 60 ? "sun" : "ok"}
          label="Vigencia"
          value={service.expires_in < 0 ? "Vencida" : `${service.expires_in} días`}
          note={`hasta ${formatDate(service.valid_to)}`}
          info={<p>Días que faltan para el fin de la vigencia del servicio, contados desde hoy en hora de Lima.</p>}
        />
        <TintTile icon={Users} tone="violet" label="Capacidad" value={service.capacity ?? "Sin límite"} note={service.capacity ? "personas por servicio" : "No limita los pasajeros"} info={<p>Personas que cubre una unidad del servicio, según la ficha. Vacío significa que no tiene límite.</p>} />
        <TintTile
          icon={Building2}
          tone={provider?.state === "activo" ? "ok" : "bad"}
          label="Proveedor"
          value={provider ? SUPPLY_STATE[provider.state].label : "—"}
          note={provider ? (provider.contract_days < 0 ? "Contrato vencido" : `Contrato por ${provider.contract_days} días más`) : undefined}
          info={<p>Estado del proveedor y días que le quedan al contrato. Con el proveedor inactivo o vencido, el servicio no puede usarse.</p>}
        />
      </section>
      <TabbedCard
        tabs={[
          { href: base, label: "Ficha" },
          { href: `${base}/productos`, label: "Productos que lo usan" },
          ...(detail.history ? [{ href: `${base}/historial`, label: "Historial", count: detail.history.length }] : []),
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
