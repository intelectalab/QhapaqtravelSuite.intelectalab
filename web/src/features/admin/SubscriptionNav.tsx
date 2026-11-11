"use client";

import { BarChart3, CreditCard, LayoutDashboard, PackagePlus, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { SectionNav } from "@/components/ui/SectionNav";

const BASE = "/admin/suscripcion";

export function SubscriptionNav({ addons, invoices }: { addons: number; invoices: number }) {
  const pathname = usePathname();
  const active = pathname === BASE ? "resumen" : (pathname.slice(BASE.length + 1).split("/")[0] ?? "resumen");
  return (
    <SectionNav
      label="Secciones de la suscripción"
      active={active}
      testId="subscription-nav"
      groups={[
        {
          title: "Suscripción",
          items: [
            { id: "resumen", label: "Resumen", href: BASE, icon: <LayoutDashboard size={16} /> },
            { id: "planes", label: "Tu plan", href: `${BASE}/planes`, icon: <ShieldCheck size={16} /> },
            { id: "comparar", label: "Comparar planes", href: `${BASE}/comparar`, icon: <Sparkles size={16} /> },
            { id: "complementos", label: "Complementos", href: `${BASE}/complementos`, count: addons, icon: <PackagePlus size={16} /> },
          ],
        },
        {
          title: "Facturación",
          items: [
            { id: "facturas", label: "Facturas", href: `${BASE}/facturas`, count: invoices, icon: <ReceiptText size={16} /> },
            { id: "pago", label: "Método de pago y datos", href: `${BASE}/pago`, icon: <CreditCard size={16} /> },
            { id: "historial", label: "Historial de consumo", href: `${BASE}/historial`, icon: <BarChart3 size={16} /> },
          ],
        },
      ]}
    />
  );
}
