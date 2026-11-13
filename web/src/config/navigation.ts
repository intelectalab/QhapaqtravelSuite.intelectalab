import type { MotifId } from "@/lib/motifs";
import { Award, BarChart3, BedDouble, Bell, BellRing, FileSpreadsheet, Gift, ScanLine, Box, Brain, Briefcase, Building, Building2, CalendarCheck, CalendarClock, CalendarDays, CircleCheck, ClipboardList, Coins, CreditCard, Database, FileCheck2, FileText, Filter, Globe, Grid3x3, Handshake, Heart, KeyRound, Layers, Layers3, LayoutDashboard, LayoutTemplate, LifeBuoy, Link2, Luggage, Mail, Map, MapPinned, Megaphone, MessageCircle, MessagesSquare, Network, Palette, Percent, Plug, Radio, Receipt, ReceiptText, RotateCcw, Route, Scale, Send, Settings, Share2, ShieldCheck, ShoppingCart, SlidersHorizontal, Smartphone, Sparkles, Star, Tag, Target, Ticket, TrendingUp, TriangleAlert, Truck, type LucideIcon, Upload, User, Users, Wallet } from "lucide-react";

export interface Screen {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: NavCountKey;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  motif: MotifId;
  screens: Screen[];
}

export type NavCountKey = "leads" | "activities" | "quotes" | "incidents";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "general",
    label: "General",
    icon: LayoutDashboard,
    motif: "inti",
    screens: [
      { href: "/dashboard", label: "Panel de control", icon: LayoutDashboard },
      { href: "/flujo", label: "Mapa de procesos", icon: Route },
      { href: "/aprobaciones", label: "Bandeja de aprobaciones", icon: CircleCheck },
      { href: "/inbox", label: "Bandeja omnicanal", icon: MessagesSquare },
      { href: "/ayuda", label: "Centro de ayuda", icon: LifeBuoy },
    ],
  },
  {
    id: "crm",
    label: "Comercial · CRM",
    icon: Users,
    motif: "personas",
    screens: [
      { href: "/crm/leads", label: "Leads", icon: Filter, countKey: "leads" },
      { href: "/crm/oportunidades", label: "Oportunidades", icon: Target },
      { href: "/crm/actividades", label: "Actividades", icon: CalendarDays, countKey: "activities" },
      { href: "/crm/clientes", label: "Clientes", icon: Users },
      { href: "/crm/postventa", label: "Postventa y fidelización", icon: Heart },
      { href: "/crm/metas", label: "Metas comerciales", icon: Award },
      { href: "/crm/reclamaciones", label: "Libro de reclamaciones", icon: ClipboardList },
      { href: "/crm/cuentas-corporativas", label: "Cuentas corporativas", icon: Building2 },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    motif: "condor",
    screens: [
      { href: "/marketing/campanas", label: "Campañas y segmentos", icon: Send },
      { href: "/marketing/recuperacion", label: "Recuperación de ventas", icon: RotateCcw },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo turístico",
    icon: MapPinned,
    motif: "montanas",
    screens: [
      { href: "/catalogo/productos", label: "Productos", icon: Box },
      { href: "/catalogo/categorias", label: "Tipos y categorías", icon: Layers3 },
      { href: "/catalogo/salidas", label: "Salidas y disponibilidad", icon: CalendarDays },
      { href: "/catalogo/tarifas", label: "Tarifas y temporadas", icon: Tag },
      { href: "/catalogo/cupos", label: "Cupos y bloqueos", icon: Grid3x3 },
      { href: "/catalogo/servicios", label: "Servicios", icon: Layers },
      { href: "/catalogo/proveedores", label: "Proveedores", icon: Building2 },
      { href: "/catalogo/destinos", label: "Destinos", icon: Map },
      { href: "/catalogo/importar", label: "Importar con IA", icon: Upload },
      { href: "/catalogo/precios-dinamicos", label: "Precios dinámicos", icon: SlidersHorizontal },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: Briefcase,
    motif: "chakana",
    screens: [
      { href: "/cotizaciones", label: "Cotizaciones", icon: FileText, countKey: "quotes" },
      { href: "/reservas", label: "Reservas", icon: Luggage },
      { href: "/asistente", label: "Asistente de ventas", icon: Sparkles },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    icon: Truck,
    motif: "llamas",
    screens: [
      { href: "/operaciones/ordenes", label: "Órdenes operativas", icon: ClipboardList },
      { href: "/operaciones/calendario", label: "Calendario operativo", icon: CalendarClock },
      { href: "/operaciones/asignaciones", label: "Asignaciones y recursos", icon: Truck },
      { href: "/operaciones/rooming", label: "Rooming list", icon: BedDouble },
      { href: "/operaciones/vouchers", label: "Vouchers", icon: Ticket },
      { href: "/operaciones/documentos-viaje", label: "Documentos de viaje", icon: FileCheck2 },
      { href: "/operaciones/incidencias", label: "Incidencias", icon: TriangleAlert, countKey: "incidents" },
      { href: "/operaciones/checkin", label: "Check-in con QR", icon: ScanLine },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: Wallet,
    motif: "greca",
    screens: [
      { href: "/finanzas/cobros", label: "Cuentas por cobrar", icon: Wallet },
      { href: "/finanzas/pagos", label: "Pagos y aplicaciones", icon: CreditCard },
      { href: "/finanzas/proveedores", label: "Cuentas por pagar", icon: Coins },
      { href: "/finanzas/comisiones", label: "Comisiones", icon: Percent },
      { href: "/finanzas/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
      { href: "/finanzas/cierre", label: "Cierre de periodo", icon: CalendarCheck },
      { href: "/finanzas/facturacion", label: "Facturación", icon: Receipt },
      { href: "/finanzas/tesoreria", label: "Tesorería (caja y bancos)", icon: Database },
      { href: "/finanzas/estados-cuenta-corporativos", label: "Estados de cuenta corporativos", icon: ReceiptText },
      { href: "/finanzas/conciliacion", label: "Conciliación bancaria", icon: Scale },
      { href: "/finanzas/links-de-pago", label: "Links de pago", icon: Link2 },
      { href: "/finanzas/vales", label: "Vales de regalo", icon: Gift },
      { href: "/finanzas/exportacion-contable", label: "Exportación contable", icon: FileSpreadsheet },
      { href: "/finanzas/pasarelas", label: "Pasarelas y comisiones", icon: CreditCard },
    ],
  },
  {
    id: "canales",
    label: "Canales",
    icon: Radio,
    motif: "sombreros",
    screens: [
      { href: "/canales/b2b", label: "B2B agencias", icon: Handshake },
      { href: "/canales/ecommerce", label: "E-commerce", icon: ShoppingCart },
      { href: "/canales/cms", label: "CMS", icon: LayoutTemplate },
      { href: "/canales/plantillas", label: "Plantillas del sitio", icon: Palette },
      { href: "/canales/contenido-ia", label: "Contenido con IA", icon: Sparkles },
      { href: "/canales/integracion-web", label: "Integración web y CMS", icon: Link2 },
      { href: "/canales/seguimiento", label: "Seguimiento y píxeles", icon: Target },
      { href: "/canales/resenas-propias", label: "Reseñas de clientes", icon: Award },
      { href: "/canales/resenas", label: "Reseñas externas", icon: Star },
      { href: "/canales/portal-cliente", label: "Portal del cliente", icon: Globe },
      { href: "/canales/portal-pasajero", label: "Portal del pasajero", icon: User },
      { href: "/canales/ota", label: "OTAs", icon: Share2 },
      { href: "/canales/marketplace", label: "Marketplace B2B", icon: Network },
      { href: "/canales/seo", label: "Dominio y SEO", icon: SlidersHorizontal },
      { href: "/canales/aventuras", label: "Blog de aventuras", icon: Heart },
      { href: "/canales/vitrina", label: "Vitrina Rutas Libres", icon: Ticket },
    ],
  },
  {
    id: "movil",
    label: "Móvil",
    icon: Smartphone,
    motif: "lagartija",
    screens: [
      { href: "/mobile/operador", label: "App operador", icon: Smartphone },
      { href: "/mobile/pasajero", label: "App pasajero", icon: Smartphone },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligencia",
    icon: Brain,
    motif: "rombo",
    screens: [
      { href: "/reportes", label: "Reportes y KPIs", icon: BarChart3 },
      { href: "/reportes/alertas", label: "Alertas de rentabilidad", icon: BellRing },
      { href: "/reportes/visitas", label: "Visitas del sitio", icon: TrendingUp },
    ],
  },
  {
    id: "admin",
    label: "Administración",
    icon: Building,
    motif: "tocapu",
    screens: [
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      { href: "/admin/sedes", label: "Sedes", icon: Building2 },
      { href: "/admin/roles", label: "Roles y permisos", icon: KeyRound },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings },
      { href: "/admin/personalizacion", label: "Personalización", icon: Palette },
      { href: "/admin/reglas", label: "Reglas de reserva", icon: ShieldCheck },
      { href: "/admin/comunicaciones", label: "Mensajes al pasajero", icon: Mail },
      { href: "/admin/whatsapp", label: "WhatsApp Business", icon: MessageCircle },
      { href: "/admin/monedas", label: "Monedas y tipo de cambio", icon: Coins },
      { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell },
      { href: "/admin/suscripcion", label: "Suscripción y uso", icon: ReceiptText },
      { href: "/admin/api", label: "API y webhooks", icon: Link2 },
      { href: "/admin/integraciones", label: "Integraciones y jobs", icon: Plug },
      { href: "/admin/auditoria", label: "Auditoría", icon: ShieldCheck },
    ],
  },
];

export const HOME_HREF = "/dashboard";

export function screensOf(groups: NavGroup[]): Screen[] {
  return groups.flatMap((group) => group.screens);
}

export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function screenFor(pathname: string, groups: NavGroup[] = NAV_GROUPS): Screen | undefined {
  return screensOf(groups)
    .sort((a, b) => b.href.length - a.href.length)
    .find((screen) => isUnder(pathname, screen.href));
}

export function groupFor(pathname: string, groups: NavGroup[] = NAV_GROUPS): NavGroup | undefined {
  const screen = screenFor(pathname, groups);
  return screen ? groups.find((group) => group.screens.includes(screen)) : undefined;
}
