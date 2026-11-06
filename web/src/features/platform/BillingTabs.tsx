import { SectionTabs } from "@/components/ui/SectionTabs";

const TABS = [
  { href: "/plataforma/facturacion", label: "Resumen" },
  { href: "/plataforma/facturacion/facturas", label: "Facturas" },
  { href: "/plataforma/facturacion/cobranza", label: "Cobranza" },
  { href: "/plataforma/facturacion/trials", label: "Pruebas" },
  { href: "/plataforma/facturacion/cupones", label: "Cupones" },
  { href: "/plataforma/facturacion/flags", label: "Funcionalidades" },
  { href: "/plataforma/facturacion/uso", label: "Uso" },
];

export function BillingTabs({ counts = {} }: { counts?: Partial<Record<string, number>> }) {
  return (
    <div className="-mx-1 mb-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <SectionTabs tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.href] }))} />
    </div>
  );
}
