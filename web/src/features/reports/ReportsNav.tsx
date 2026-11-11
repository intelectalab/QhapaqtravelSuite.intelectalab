"use client";

import { BarChart3, Briefcase, Download, FileText, LayoutDashboard, Plane, Truck, UsersRound, Wallet, Workflow } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { SectionNav } from "@/components/ui/SectionNav";
import type { ReportKey, ReportTab } from "@/lib/reports";

const ICONS: Record<ReportKey, ReactNode> = {
  comercial: <Briefcase size={16} />,
  cotizaciones: <FileText size={16} />,
  reservas: <Plane size={16} />,
  operaciones: <Workflow size={16} />,
  finanzas: <Wallet size={16} />,
  proveedores: <Truck size={16} />,
  clientes: <UsersRound size={16} />,
};

export function ReportsNav({ tabs, exports, canExport }: { tabs: ReportTab[]; exports: number; canExport: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === "/reportes" ? "resumen" : (pathname.split("/")[2] ?? "resumen");
  const keep = new URLSearchParams();
  for (const key of ["period", "sede"]) {
    const value = params.get(key);
    if (value) keep.set(key, value);
  }
  const suffix = keep.size ? `?${keep}` : "";
  return (
    <SectionNav
      label="Reportes"
      active={active}
      testId="reports-nav"
      groups={[
        { title: "General", items: [{ id: "resumen", label: "Resumen", href: "/reportes", icon: <LayoutDashboard size={16} /> }] },
        { title: "Reportes de tu rol", items: tabs.map((tab) => ({ id: tab.key, label: tab.title, href: `/reportes/${tab.key}${suffix}`, icon: ICONS[tab.key] ?? <BarChart3 size={16} /> })) },
        ...(canExport ? [{ title: "Archivos", items: [{ id: "exportaciones", label: "Exportaciones", href: "/reportes/exportaciones", count: exports, icon: <Download size={16} /> }] }] : []),
      ]}
    />
  );
}
