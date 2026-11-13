import { ArrowRight, BadgeCheck, BarChart3, CalendarCheck, CalendarDays, ChevronRight, ClipboardList, Coins, FileCheck, FileText, Funnel, Globe, HeartHandshake, Lock, Luggage, Smartphone, Target, Ticket, TrendingUp, Truck, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";

type CanOpen = (href: string) => boolean;

const CHAIN: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Lead", href: "/crm/leads", icon: Funnel },
  { label: "Oportunidad", href: "/crm/oportunidades", icon: Target },
  { label: "Actividad", href: "/crm/actividades", icon: CalendarCheck },
  { label: "Cotización", href: "/cotizaciones", icon: FileText },
  { label: "Aprobación", href: "/aprobaciones", icon: FileCheck },
  { label: "Reserva", href: "/reservas", icon: Luggage },
  { label: "Disponibilidad", href: "/catalogo/salidas", icon: CalendarDays },
  { label: "Orden operativa", href: "/operaciones/ordenes", icon: ClipboardList },
  { label: "Asignación", href: "/operaciones/asignaciones", icon: Truck },
  { label: "Voucher", href: "/operaciones/vouchers", icon: Ticket },
  { label: "Ejecución", href: "/mobile/operador", icon: Smartphone },
  { label: "Cobro", href: "/finanzas/cobros", icon: Wallet },
  { label: "Costo", href: "/finanzas/proveedores", icon: Coins },
  { label: "Rentabilidad", href: "/finanzas/rentabilidad", icon: TrendingUp },
  { label: "Portal", href: "/canales/portal-cliente", icon: Globe },
  { label: "Reporte", href: "/reportes", icon: BarChart3 },
  { label: "Postventa", href: "/crm/postventa", icon: HeartHandshake },
];

const ROLE_STAGES: Record<string, string[]> = {
  sales: ["Lead", "Oportunidad", "Actividad", "Cotización", "Reserva", "Postventa"],
  manager: ["Oportunidad", "Aprobación", "Reserva", "Rentabilidad", "Reporte", "Postventa"],
  operations: ["Reserva", "Disponibilidad", "Orden operativa", "Asignación", "Voucher", "Ejecución"],
  finance: ["Cobro", "Costo", "Rentabilidad", "Reporte"],
  accounting: ["Cobro", "Reporte"],
};

const MACHINES: { entity: string; tone: Tone; path: string[]; alternatives: string | null }[] = [
  { entity: "Cotización", tone: "t3", path: ["Borrador", "Enviada", "Vista", "Negociación", "Aprobada", "Convertida en reserva"], alternatives: "Rechazada, vencida o cancelada" },
  { entity: "Reserva", tone: "ok", path: ["Borrador", "Pendiente de disponibilidad", "Confirmada", "En operación", "Completada"], alternatives: "Cancelada, reprogramada, parcial, pendiente de pago, pendiente de proveedor o con incidencia" },
  { entity: "Disponibilidad", tone: "info", path: ["Disponible", "Retenida", "Confirmada", "Consumida"], alternatives: "Liberada o expirada" },
  { entity: "Operación", tone: "t4", path: ["Planificada", "Pendiente de asignación", "Asignada", "Confirmada", "En ejecución", "Completada"], alternatives: null },
  { entity: "Pago", tone: "sun", path: ["Pendiente", "Confirmado", "Aplicado"], alternatives: "Revertido" },
  { entity: "Cuenta por cobrar o por pagar", tone: "violet", path: ["Abierta", "Parcial", "Pagada"], alternatives: "Vencida o cancelada" },
  { entity: "Producto turístico", tone: "t1", path: ["Borrador", "En revisión", "Aprobado", "Activo"], alternatives: "Suspendido, inactivo o archivado" },
];

const DOMAINS: { name: string; range: string; detail: string; href: string }[] = [
  { name: "Administración", range: "PROC-001 a 003", detail: "Alta de la agencia, usuarios, roles, permisos y configuración", href: "/admin/usuarios" },
  { name: "CRM", range: "PROC-004 a 010", detail: "Captación, calificación, oportunidades, actividades, cliente 360, postventa y fidelización", href: "/crm/leads" },
  { name: "Catálogo", range: "PROC-011 a 020", detail: "Destinos, proveedores, servicios, productos, itinerarios, tarifas, temporadas y disponibilidad", href: "/catalogo/productos" },
  { name: "Cotización", range: "PROC-021 a 024", detail: "Creación, versiones, envío con enlace y aprobación o rechazo", href: "/cotizaciones" },
  { name: "Reservas", range: "PROC-025 a 030", detail: "Conversión, reserva, modificación, cancelación, reprogramación, grupos y B2B", href: "/reservas" },
  { name: "Operaciones", range: "PROC-031 a 039", detail: "Orden operativa, proveedor, asignación, rooming, voucher, ejecución, incidencias y cierre", href: "/operaciones/ordenes" },
  { name: "Finanzas", range: "PROC-040 a 050", detail: "Cobros, anticipos, pagos, costos, comisiones, rentabilidad, conciliación y facturación", href: "/finanzas/cobros" },
  { name: "Canales", range: "PROC-051 a 055", detail: "Portal del cliente y del pasajero, B2B, tienda en línea y contenidos", href: "/canales/b2b" },
  { name: "Móvil", range: "PROC-056 a 058", detail: "App del operador, app del pasajero y trabajo sin conexión", href: "/mobile/operador" },
  { name: "Plataforma", range: "PROC-059 a 065", detail: "Notificaciones, reportes, exportación, acceso, auditoría e integraciones", href: "/admin/auditoria" },
];

const E2E: { code: string; path: string; href: string }[] = [
  { code: "E2E-01", path: "Lead → oportunidad → actividad → cotización → aprobación", href: "/crm/leads" },
  { code: "E2E-02", path: "Cotización aprobada → reserva", href: "/cotizaciones" },
  { code: "E2E-03", path: "Reserva → servicios → proveedor → asignación → voucher", href: "/reservas" },
  { code: "E2E-04", path: "Asignación → check-in → ejecución → evidencia → fin", href: "/mobile/operador" },
  { code: "E2E-05", path: "Reserva → obligación → pago → costo → rentabilidad", href: "/finanzas/cobros" },
  { code: "E2E-06", path: "Reserva → viaje → itinerario → documentos en el portal", href: "/canales/portal-pasajero" },
  { code: "E2E-07", path: "Asignación → app del operador → ejecución → sincronización", href: "/mobile/operador" },
  { code: "E2E-08", path: "Una agencia no puede ver los datos de otra", href: "/admin/auditoria" },
  { code: "E2E-09", path: "Cancelación → disponibilidad → finanzas → auditoría", href: "/reservas" },
  { code: "E2E-10", path: "Incidencia → alerta → resolución → cierre", href: "/operaciones/incidencias" },
];

const HANDOFF: { from: string; to: string; deliverable: string }[] = [
  { from: "Canales y marketing", to: "CRM", deliverable: "Lead" },
  { from: "CRM", to: "Comercial", deliverable: "Oportunidad" },
  { from: "Comercial", to: "Cotización", deliverable: "Contexto y requerimiento" },
  { from: "Cotización", to: "Reserva", deliverable: "Versión aprobada con su copia del catálogo" },
  { from: "Reserva", to: "Operaciones", deliverable: "Servicios, pasajeros y fechas" },
  { from: "Operaciones", to: "Finanzas", deliverable: "Costos y ejecución" },
  { from: "Finanzas", to: "Administración", deliverable: "Saldos y rentabilidad" },
  { from: "Operaciones", to: "Portal", deliverable: "Itinerario, vouchers y estado" },
  { from: "Operaciones", to: "Móvil", deliverable: "Asignaciones" },
  { from: "Todos", to: "Reportes", deliverable: "Datos para el análisis" },
  { from: "Viaje cerrado", to: "CRM", deliverable: "Historial y postventa" },
];

const NOT_AVAILABLE = "No disponible para tu rol";

export function RoleChain({ role, roleName, can }: { role: string; roleName: string; can: CanOpen }) {
  const mine = ROLE_STAGES[role] ?? (role === "tenant_admin" ? CHAIN.map((stage) => stage.label) : []);
  const counts = { mine: CHAIN.filter((stage) => mine.includes(stage.label) && can(stage.href)).length, open: CHAIN.filter((stage) => can(stage.href)).length };

  return (
    <Card className="mb-5">
      <TintCardTitle icon={BadgeCheck} title="Recorrido completo y tu rol" aside={<InfoTip label="Cómo se lee">Se resaltan las etapas a cargo de {roleName}. Las que tu rol no puede abrir aparecen con candado.</InfoTip>} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {CHAIN.map((stage, index) => {
          const open = can(stage.href);
          const own = open && mine.includes(stage.label);
          const body = (
            <>
              <span className={cn("grid h-6 w-6 flex-none place-items-center rounded-full", own ? "bg-[var(--tint)] text-white" : "bg-surface-2 text-fg-3")}>{open ? <stage.icon size={13} /> : <Lock size={12} />}</span>
              {stage.label}
            </>
          );
          return (
            <li key={stage.label} className="flex items-center gap-1.5" style={{ animationDelay: `${index * 40}ms` }}>
              {open ? (
                <Link href={stage.href} title={own ? "Etapa a cargo de tu rol" : "Puedes consultar esta etapa"} style={toneStyle("t1")} className={cn("lift inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] font-medium", own ? "border-[color-mix(in_srgb,var(--tint)_45%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] text-fg" : "border-line bg-surface text-fg-2")}>
                  {body}
                </Link>
              ) : (
                <span title={NOT_AVAILABLE} aria-disabled="true" className="inline-flex items-center gap-2 rounded-full border border-dashed border-line py-1 pl-1 pr-3 text-[12.5px] text-fg-3 opacity-70">
                  {body}
                </span>
              )}
              {index < CHAIN.length - 1 && <ChevronRight size={13} className="text-fg-3" />}
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-fg-3" style={toneStyle("t1")}>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" />A cargo de tu rol · <b className="text-fg">{counts.mine}</b></li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-line bg-surface" />Puedes consultar · <b className="text-fg">{counts.open - counts.mine}</b></li>
        <li className="flex items-center gap-1.5"><Lock size={11} />{NOT_AVAILABLE} · <b className="text-fg">{CHAIN.length - counts.open}</b></li>
      </ul>
    </Card>
  );
}

export function StateMachines() {
  return (
    <Card className="h-full">
      <TintCardTitle icon={ClipboardList} title="Máquinas de estado" aside={<InfoTip label="Qué muestra">El camino principal de cada entidad, de izquierda a derecha. Debajo, los estados alternativos.</InfoTip>} />
      <ul className="flex flex-col gap-4">
        {MACHINES.map((machine) => (
          <li key={machine.entity} style={toneStyle(machine.tone)}>
            <p className="mb-1.5 text-[13.5px] font-semibold">{machine.entity}</p>
            <ol className="flex flex-wrap items-center gap-1">
              {machine.path.map((step, index) => (
                <li key={step} className="flex items-center gap-1">
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] px-2.5 py-0.5 text-[12px] font-medium text-fg transition-colors hover:bg-[color-mix(in_srgb,var(--tint)_22%,var(--surface))]">{step}</span>
                  {index < machine.path.length - 1 && <ArrowRight size={12} className="text-[var(--tint)]" />}
                </li>
              ))}
            </ol>
            {machine.alternatives && <p className="mt-1 text-[12px] text-fg-3">Otros estados: {machine.alternatives}.</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DomainsAndCases({ can }: { can: CanOpen }) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={Target} title="Dominios y procesos" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {DOMAINS.map((domain) => {
            const open = can(domain.href);
            const body = (
              <>
                <span className="flex items-center gap-2">
                  <b className="text-[13px] font-semibold">{domain.name}</b>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-3">{domain.range}</span>
                  {!open && <Lock size={12} className="ml-auto text-fg-3" />}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{domain.detail}</span>
              </>
            );
            return (
              <li key={domain.name}>
                {open ? (
                  <Link href={domain.href} className="lift block h-full rounded-tile border border-line px-3 py-2.5 hover:border-[color-mix(in_srgb,var(--t1)_40%,transparent)]">
                    {body}
                  </Link>
                ) : (
                  <span title={NOT_AVAILABLE} className="block h-full rounded-tile border border-dashed border-line px-3 py-2.5 opacity-60">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <TintCardTitle icon={FileCheck} title="Casos de punta a punta" aside={<InfoTip label="Para qué sirven">Los recorridos que el sistema debe completar sin cortes. Cada uno se prueba de forma automática.</InfoTip>} />
        <ul className="flex flex-col">
          {E2E.map((item) => {
            const open = can(item.href);
            const content = (
              <>
                <span className="w-[60px] flex-none font-mono text-[11.5px] font-semibold text-fg-3">{item.code}</span>
                <span className="min-w-0 flex-1 text-[13px]">{item.path}</span>
                {open ? <ChevronRight size={14} className="flex-none text-fg-3" /> : <Lock size={12} className="flex-none text-fg-3" />}
              </>
            );
            return (
              <li key={item.code} className="border-t border-line-2 first:border-t-0">
                {open ? (
                  <Link href={item.href} className="flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-surface-2">
                    {content}
                  </Link>
                ) : (
                  <span title={NOT_AVAILABLE} className="flex items-center gap-3 px-1.5 py-2 opacity-60">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

export function HandoffMatrix() {
  return (
    <Card>
      <TintCardTitle icon={ArrowRight} title="Qué se entregan los equipos" aside={<InfoTip label="Matriz de traspaso">Cada fila es un traspaso entre áreas: quién entrega, quién recibe y qué recibe.</InfoTip>} />
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {HANDOFF.map((row) => (
          <li key={`${row.from}-${row.to}-${row.deliverable}`} className="lift flex items-center gap-2 rounded-tile border border-line px-3 py-2.5 text-[12.5px]">
            <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 font-semibold">{row.from}</span>
            <ArrowRight size={13} className="flex-none text-fg-3" />
            <span className="flex-none rounded-full bg-[color-mix(in_srgb,var(--t1)_12%,var(--surface))] px-2 py-0.5 font-semibold">{row.to}</span>
            <span className="min-w-0 flex-1 truncate text-right text-fg-3" title={row.deliverable}>{row.deliverable}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
