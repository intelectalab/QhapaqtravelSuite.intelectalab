import { BarChart3, CalendarDays, Compass, FilePlus2, Landmark, ReceiptText, Scale, Truck, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountingPanel } from "@/features/dashboard/AccountingPanel";
import type { CanOpen } from "@/features/dashboard/DashboardBlocks";
import { ExecutivePanel } from "@/features/dashboard/ExecutivePanel";
import { FinancePanel } from "@/features/dashboard/FinancePanel";
import { OperationsPanel } from "@/features/dashboard/OperationsPanel";
import { SalesPanel } from "@/features/dashboard/SalesPanel";
import { isAllowed } from "@/lib/access";
import type { HomePanel, PanelName } from "@/lib/dashboard";
import { capitalize, formatDate } from "@/lib/format";
import { getAccess, getHomeDashboard } from "@/lib/server/dashboard";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: "Panel de control" };

interface PanelLook {
  name: string;
  scope: string;
  actions: { href: string; label: string; icon: ReactNode; primary?: boolean }[];
}

const LOOK: Record<PanelName, PanelLook> = {
  executive: { name: "Panel ejecutivo", scope: "Resumen comercial y operativo de la agencia, en soles.", actions: [{ href: "/reportes", label: "Reportes", icon: <BarChart3 size={16} /> }, { href: "/cotizaciones/nueva", label: "Nueva cotización", icon: <FilePlus2 size={16} />, primary: true }] },
  manager: { name: "Panel de gerencia", scope: "Resumen de la agencia, aprobaciones y desempeño del equipo, en soles.", actions: [{ href: "/reportes", label: "Reportes", icon: <BarChart3 size={16} /> }, { href: "/cotizaciones/nueva", label: "Nueva cotización", icon: <FilePlus2 size={16} />, primary: true }] },
  sales: { name: "Panel de ventas", scope: "Solo tu cartera: tus leads, oportunidades, cotizaciones y actividades.", actions: [{ href: "/crm/leads", label: "Leads", icon: <Users size={16} /> }, { href: "/cotizaciones/nueva", label: "Nueva cotización", icon: <FilePlus2 size={16} />, primary: true }] },
  operations: { name: "Panel de operaciones", scope: "Servicios, proveedores, asignaciones y vouchers. Sin montos de venta ni márgenes.", actions: [{ href: "/operaciones/calendario", label: "Calendario", icon: <CalendarDays size={16} /> }, { href: "/operaciones/asignaciones", label: "Asignaciones", icon: <Truck size={16} />, primary: true }] },
  finance: { name: "Panel de finanzas", scope: "Caja, cuentas por cobrar y por pagar, comisiones y margen, en soles.", actions: [{ href: "/finanzas/conciliacion", label: "Conciliación", icon: <Scale size={16} /> }, { href: "/finanzas/pagos", label: "Pagos", icon: <Wallet size={16} />, primary: true }] },
  accounting: { name: "Panel de contabilidad", scope: "Comprobantes electrónicos, cobranza documentada y cierre del periodo.", actions: [{ href: "/finanzas/cobros", label: "Cobros", icon: <Landmark size={16} /> }, { href: "/finanzas/facturacion", label: "Facturación", icon: <ReceiptText size={16} />, primary: true }] },
  general: { name: "Inicio", scope: "Tu rol todavía no tiene un panel con datos.", actions: [] },
};

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("es-PE", { hour: "numeric", hourCycle: "h23", timeZone: "America/Lima" }).format(new Date()));
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

function PanelBody({ home, can }: { home: HomePanel; can: CanOpen }) {
  switch (home.panel) {
    case "executive":
    case "manager":
      return <ExecutivePanel data={home.data} can={can} />;
    case "sales":
      return <SalesPanel data={home.data} can={can} />;
    case "operations":
      return <OperationsPanel data={home.data} can={can} />;
    case "finance":
      return <FinancePanel data={home.data} can={can} />;
    case "accounting":
      return <AccountingPanel data={home.data} can={can} />;
    default:
      return <EmptyState icon={<Compass size={20} />} title="Aún no hay un panel para tu rol" description="Usa el menú para entrar a los módulos que tienes habilitados. Si necesitas un panel, pídeselo al administrador de la agencia." />;
  }
}

export default async function InicioPage() {
  const [me, home, access] = await Promise.all([currentUser(), getHomeDashboard(), getAccess()]);
  const can: CanOpen = (href) => isAllowed(access?.screens ?? null, href);
  const look = LOOK[home.panel];
  const today = home.data?.today ?? new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[36px]">
            {greeting()}, {me.name.split(" ")[0]}
            <span className="text-brand">.</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] text-fg-3">
            <b className="font-semibold text-fg-2">{look.name}</b> · {look.scope}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="mr-2 text-right text-[13px] text-fg-3">
            <b className="mb-0.5 block font-mono text-[13px] font-semibold tracking-wide text-fg">{capitalize(formatDate(today, "long"))}</b>
            {me.tenant.name}
          </p>
          {look.actions
            .filter((action) => can(action.href))
            .map((action) => (
              <Button key={action.href} href={action.href} icon={action.icon} variant={action.primary ? "primary" : "secondary"}>
                {action.label}
              </Button>
            ))}
        </div>
      </div>
      <PanelBody home={home} can={can} />
    </>
  );
}
