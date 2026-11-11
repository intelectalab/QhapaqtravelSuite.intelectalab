import { Boxes, Building2, CalendarClock, ClipboardList, History, Layers, Receipt, Star, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { TintTile } from "@/components/ui/Tinted";
import { SupplyAlerts, type SupplyAlert } from "@/features/catalog-shared/SupplyAlerts";
import { ProviderRateAction, ProviderRenewAction } from "@/features/catalog-providers/ProviderContractActions";
import { ProviderEditAction, ProviderToggleAction } from "@/features/catalog-providers/ProviderForms";
import { SUPPLY_STATE } from "@/lib/catalog-services";
import { formatDate, formatMoney } from "@/lib/format";
import { getProvider } from "@/lib/server/catalog-supply";

export default async function ProveedorLayout({ children, params }: { children: ReactNode; params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  if (!detail) notFound();
  const { provider, can } = detail;
  const base = `/catalogo/proveedores/${encodeURIComponent(provider.ref)}`;
  const days = provider.contract_days;
  const alerts: SupplyAlert[] = days < 0
    ? [{ key: "contract", tone: "bad", text: `El contrato venció el ${formatDate(provider.contract_end)}. Sus servicios no pueden usarse como componentes hasta renovarlo.` }]
    : days <= 95
      ? [{ key: "contract", tone: "warn", text: `El contrato termina el ${formatDate(provider.contract_end)} (en ${days} días). Renuévalo antes para no bloquear los productos que lo usan.` }]
      : [];
  const balances = (detail.payables ?? []).reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.currency]: (sum[row.currency] ?? 0) + Number(row.balance) }), {});
  const owed = Object.entries(balances).filter(([, amount]) => amount > 0);
  const overdue = (detail.payables ?? []).filter((row) => row.overdue).length;
  const activeProducts = detail.products.filter((product) => product.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        back={{ href: "/catalogo/proveedores", label: "Proveedores" }}
        jump={false}
        title={provider.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={SUPPLY_STATE[provider.state].tone}>{SUPPLY_STATE[provider.state].label}</Badge>
          </span>
        }
        subtitle={`${provider.ref} · RUC ${provider.ruc} · ${provider.type}${provider.city ? ` · ${provider.city}` : ""}`}
        actions={
          can.manage ? (
            <>
              <ProviderToggleAction provider={provider} button />
              <ProviderRateAction provider={provider} />
              <ProviderEditAction overview={detail} provider={provider} button />
              <ProviderRenewAction provider={provider} today={detail.today} />
            </>
          ) : undefined
        }
      />
      <SupplyAlerts alerts={alerts} />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile
          icon={CalendarClock}
          tone={days < 0 ? "bad" : days <= 95 ? "sun" : "ok"}
          label="Contrato"
          value={days < 0 ? "Vencido" : `${days} días`}
          note={`hasta ${formatDate(provider.contract_end)}`}
          info={<p>Días que faltan para el fin del contrato, contados desde hoy en hora de Lima. Se considera por vencer a 95 días o menos.</p>}
        />
        <TintTile icon={Star} tone="violet" label="Calificación" value={provider.rating ? provider.rating.toFixed(1) : "—"} note={provider.rating ? "de 5 estrellas" : "Aún sin calificar"} info={<p>Nota que registró el equipo con «Calificar» o al editar el proveedor. Cada cambio queda en el historial.</p>} />
        <TintTile icon={Boxes} tone="t1" label="En productos activos" value={activeProducts} note="como principal o componente" info={<p>Productos activos que lo tienen como proveedor principal o que incluyen alguno de sus servicios.</p>} />
        {detail.payables !== null && (
          <TintTile
            icon={Wallet}
            tone={overdue ? "bad" : "sun"}
            label="Saldo por pagar"
            value={owed.length ? owed.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : formatMoney(0, provider.currency)}
            note={overdue ? `${overdue} documentos vencidos` : "Sin documentos vencidos"}
            info={<p>Suma de los saldos de sus cuentas por pagar en Finanzas, por moneda, sin contar las pagadas ni anuladas.</p>}
          />
        )}
      </section>
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones del proveedor"
            testId="provider-nav"
            groups={[
              {
                title: "Proveedor",
                items: [
                  { href: base, label: "Datos y contactos", icon: <Building2 size={16} /> },
                  { href: `${base}/servicios`, label: "Servicios", icon: <Layers size={16} /> },
                  { href: `${base}/productos`, label: "Productos", icon: <Boxes size={16} /> },
                ],
              },
              {
                title: "Movimientos",
                items: [
                  ...(detail.reservations !== null ? [{ href: `${base}/reservas`, label: "Reservas", icon: <ClipboardList size={16} /> }] : []),
                  ...(detail.payables !== null ? [{ href: `${base}/cuentas-por-pagar`, label: "Cuentas por pagar", icon: <Receipt size={16} /> }] : []),
                  ...(detail.history !== null ? [{ href: `${base}/historial`, label: "Historial", count: detail.history.length, icon: <History size={16} /> }] : []),
                ],
              },
            ].filter((group) => group.items.length > 0)}
          />
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
