const DETAIL: Record<string, string> = {
  Reserva: "/reservas",
  Cotización: "/cotizaciones",
  Cliente: "/crm/clientes",
  Lead: "/crm/leads",
  Oportunidad: "/crm/oportunidades",
  Actividad: "/crm/actividades",
  "Meta comercial": "/crm/metas",
  Producto: "/catalogo/productos",
  Proveedor: "/catalogo/proveedores",
  Servicio: "/catalogo/servicios",
  Cupo: "/catalogo/cupos",
  Comprobante: "/finanzas/facturacion",
  Pago: "/finanzas/pagos",
  "Cuenta por cobrar": "/finanzas/cobros",
  "Cuenta por pagar": "/finanzas/proveedores",
  Comisión: "/finanzas/comisiones",
  "Arqueo de caja": "/finanzas/tesoreria/arqueos",
  "Movimiento de tesorería": "/finanzas/tesoreria/movimientos",
  Incidencia: "/operaciones/incidencias",
  "Orden operativa": "/operaciones/ordenes",
  Voucher: "/operaciones/vouchers",
  Campaña: "/marketing/campanas",
  Usuario: "/admin/usuarios",
};

const SECTION: Record<string, string> = {
  Rol: "/admin/roles",
  Permiso: "/admin/roles",
  Sede: "/admin/sedes",
  Integración: "/admin/integraciones",
  Job: "/admin/integraciones/procesos",
  "Proceso programado": "/reportes/exportaciones",
  "Regla de reserva": "/admin/reglas",
  Notificación: "/admin/notificaciones",
  Configuración: "/admin/configuracion",
  "Plantilla de mensaje": "/admin/comunicaciones",
  "Mensaje al pasajero": "/admin/comunicaciones/historial",
  "Tipo de cambio": "/admin/monedas",
  Exportación: "/reportes/exportaciones",
};

const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function auditEntityHref(entity: string, id: string): string | null {
  if (DETAIL[entity] && CODE.test(id)) return `${DETAIL[entity]}/${encodeURIComponent(id)}`;
  if (entity === "Rol" && CODE.test(id)) return `/admin/roles?rol=${encodeURIComponent(id)}`;
  return SECTION[entity] ?? null;
}
