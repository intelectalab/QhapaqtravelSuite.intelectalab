import { Building2, Layers, LayoutDashboard, Palette, Plug, ReceiptText, Settings2, ShieldCheck } from "lucide-react";
import type { NavGroup } from "./navigation";

export const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    id: "negocio",
    label: "Negocio",
    icon: Building2,
    motif: "chakana",
    screens: [
      { href: "/plataforma/inicio", label: "Inicio", icon: LayoutDashboard },
      { href: "/plataforma/agencias", label: "Agencias", icon: Building2 },
      { href: "/plataforma/planes", label: "Planes", icon: Layers },
      { href: "/plataforma/facturacion", label: "Facturación", icon: ReceiptText },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    icon: ShieldCheck,
    motif: "condor",
    screens: [
      { href: "/plataforma/integraciones", label: "Integraciones y tareas", icon: Plug },
      { href: "/plataforma/auditoria", label: "Auditoría", icon: ShieldCheck },
    ],
  },
  {
    id: "ajustes",
    label: "Administración",
    icon: Settings2,
    motif: "tocapu",
    screens: [
      { href: "/plataforma/configuracion", label: "Configuración", icon: Settings2 },
      { href: "/plataforma/personalizacion", label: "Personalización", icon: Palette },
    ],
  },
];
