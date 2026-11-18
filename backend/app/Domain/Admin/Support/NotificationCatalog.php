<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

final class NotificationCatalog
{
    public const EVENTS = [
        'cotizacion.enviada' => ['label' => 'Cotización enviada', 'recipients' => 'Cliente', 'group' => 'Ventas'],
        'cotizacion.aprobada' => ['label' => 'Cotización aprobada', 'recipients' => 'Vendedor + Gerencia', 'group' => 'Ventas'],
        'reserva.confirmada' => ['label' => 'Reserva confirmada', 'recipients' => 'Cliente + Operaciones', 'group' => 'Reservas'],
        'pago.recibido' => ['label' => 'Pago recibido', 'recipients' => 'Cliente + Finanzas', 'group' => 'Finanzas'],
        'asignacion.creada' => ['label' => 'Asignación', 'recipients' => 'Guía / Conductor', 'group' => 'Operaciones'],
        'servicio.cambio_horario' => ['label' => 'Cambio de horario', 'recipients' => 'Pasajeros + Guía', 'group' => 'Operaciones'],
        'incidencia.critica' => ['label' => 'Incidencia crítica', 'recipients' => 'Gerencia + Operaciones', 'group' => 'Operaciones'],
        'voucher.emitido' => ['label' => 'Voucher emitido', 'recipients' => 'Cliente + Proveedor', 'group' => 'Reservas'],
        'servicio.inicio' => ['label' => 'Inicio/fin de servicio', 'recipients' => 'Pasajeros', 'group' => 'Operaciones'],
        'viaje.cierre' => ['label' => 'Cierre de viaje', 'recipients' => 'Cliente (encuesta NPS)', 'group' => 'Reservas'],
    ];

    public const SYSTEM_EVENTS = [
        'incidencia.creada' => 'Incidencia registrada',
        'pasajero.no_show' => 'Pasajero no se presentó',
        'viaje.proximo' => 'Viaje próximo',
        'cotizacion.vista' => 'Cotización abierta por el cliente',
        'pago.recordatorio' => 'Recordatorio de pago',
        'reserva.liquidada' => 'Reserva liquidada',
        'estado_cuenta.enviado' => 'Estado de cuenta',
        'integracion.fallo' => 'Falla de integración',
        'usuario.invitado' => 'Usuario invitado',
        'seguridad.mfa_reset' => 'Verificación en dos pasos reiniciada',
        'arco.solicitud' => 'Solicitud de datos personales (ARCO)',
        'exportacion.lista' => 'Exportación lista',
        'reporte.programado' => 'Reporte programado enviado',
        'actividad.vencida' => 'Actividades vencidas',
        'documentos.recordatorio' => 'Recordatorio de documentos de viaje',
        'documentos.solicitud' => 'Solicitud de documentos de viaje',
        'proveedor.contrato_vencido' => 'Contrato de proveedor vencido',
        'reclamacion.por_vencer' => 'Reclamo por vencer',
        'reclamacion.vencida' => 'Reclamo fuera de plazo',
        'meta.asignada' => 'Meta comercial asignada o ajustada',
        'incidencia.sla_vencido' => 'Plazo de incidencia vencido',
        'actividad.asignada' => 'Actividad asignada',
        'aprobacion.solicitada' => 'Aprobación por decidir',
        'aprobacion.resultado' => 'Resultado de tu solicitud de aprobación',
        'aprobacion.delegada' => 'Aprobación delegada',
        'aprobacion.informacion' => 'Te piden más información',
        'aprobacion.sla_advertencia' => 'Aprobación por vencer',
        'aprobacion.sla_vencido' => 'Aprobación vencida',
        'aprobacion_corporativa.pendiente' => 'Aprobación corporativa pendiente',
        'aprobacion_corporativa.decidida' => 'Aprobación corporativa decidida',
        'asignacion.cambio_horario' => 'Cambio de horario en una asignación',
        'asignacion.confirmada' => 'Asignación confirmada',
        'asignacion.iniciada' => 'Servicio iniciado',
        'asignacion.finalizada' => 'Servicio finalizado',
        'caja.bajo_umbral' => 'Caja bajo el mínimo',
        'caja.sin_abrir' => 'Caja sin abrir',
        'caso.asignado' => 'Caso asignado',
        'cliente.reasignado' => 'Cliente reasignado',
        'cotizacion.aprobacion_aprobada' => 'Aprobación interna de cotización aprobada',
        'cotizacion.aprobacion_rechazada' => 'Aprobación interna de cotización rechazada',
        'cotizacion.reasignada' => 'Cotización reasignada',
        'cotizacion.rechazada' => 'Cotización rechazada',
        'cupo.ampliacion' => 'Ampliación de cupo',
        'cupo.liberacion' => 'Liberación de cupo',
        'cupo.release' => 'Liberación automática de cupo',
        'cupo.release_proximo' => 'Liberación de cupo próxima',
        'disponibilidad.confirmada' => 'Disponibilidad confirmada',
        'efectivo.sin_depositar' => 'Efectivo sin depositar',
        'inbox.asignada' => 'Conversación asignada',
        'inbox.mensaje' => 'Mensaje nuevo en la bandeja',
        'inbox.nueva' => 'Conversación nueva',
        'inbox.sla_por_vencer' => 'Primera respuesta por vencer',
        'inbox.sla_vencido' => 'Primera respuesta vencida',
        'incidencia.asignada' => 'Incidencia asignada',
        'incidencia.escalada' => 'Incidencia escalada',
        'lead.asignado' => 'Lead asignado',
        'lead.convertido' => 'Lead convertido',
        'meta.por_cerrar' => 'Meta por cerrar',
        'nps.detractor' => 'Cliente insatisfecho en la encuesta',
        'oportunidad.asignada' => 'Oportunidad asignada',
        'oportunidad.ganada' => 'Oportunidad ganada',
        'oportunidad.perdida' => 'Oportunidad perdida',
        'orden.creada' => 'Orden operativa creada',
        'orden.responsable' => 'Responsable de una orden operativa',
        'pago.rechazado' => 'Pago rechazado',
        'pago.revertido' => 'Pago revertido',
        'producto.sin_tarifa' => 'Producto sin tarifa vigente',
        'proveedor.activado' => 'Proveedor activado',
        'proveedor.alternativa_aceptada' => 'Alternativa del proveedor aceptada',
        'proveedor.alternativa_rechazada' => 'Alternativa del proveedor rechazada',
        'proveedor.contrato_por_vencer' => 'Contrato de proveedor por vencer',
        'proveedor.solicitud' => 'Solicitud al proveedor',
        'reclamacion.asignada' => 'Reclamo asignado',
        'recurso.documento_vence' => 'Documento de un recurso por vencer',
        'reembolso.por_pagar' => 'Reembolso por pagar',
        'regla.automatizacion' => 'Aviso de una regla automática',
        'reposicion.approved' => 'Reposición de caja aprobada',
        'reposicion.rejected' => 'Reposición de caja rechazada',
        'reposicion.pagada' => 'Reposición de caja pagada',
        'reserva.anulacion_aprobada' => 'Anulación de reserva aprobada',
        'reserva.anulacion_rechazada' => 'Anulación de reserva rechazada',
        'reserva.modificacion_aprobada' => 'Modificación de reserva aprobada',
        'reserva.modificacion_rechazada' => 'Modificación de reserva rechazada',
        'reserva.cancelada' => 'Reserva cancelada',
        'reserva.incidencia' => 'Incidencia en una reserva',
        'reserva.reasignada' => 'Reserva reasignada',
        'reserva.rechazo_proveedor' => 'El proveedor rechazó un servicio',
        'rooming.enviado' => 'Rooming list enviada',
        'salida.grupo_minimo' => 'Salida sin el grupo mínimo',
        'servicio.vigencia_por_vencer' => 'Vigencia de un servicio por vencer',
        'voucher.pendiente' => 'Voucher pendiente',
    ];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'push' => 'Push', 'portal' => 'Portal'];

    public const TIMINGS = ['immediate' => 'Inmediato', 'batch_15m' => 'Agrupado cada 15 min', 'business_hours' => 'Solo en horario de atención'];

    public const CONDITIONS = ['always' => 'Siempre', 'marketing_consent' => 'Solo con consentimiento de marketing', 'amount_gt_5000' => 'Solo si el monto supera S/ 5 000'];

    public const TEMPLATE_CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'push' => 'Push'];

    public const VARIABLES = ['cliente', 'reserva', 'cotizacion', 'fecha_viaje', 'monto', 'servicio', 'hora', 'enlace', 'agencia', 'vendedor', 'documentos'];

    public const SAMPLE = [
        'cliente' => 'Ana Torres',
        'reserva' => 'RES-2026-000350',
        'cotizacion' => 'COT-2026-00188',
        'fecha_viaje' => '12/10/2026',
        'monto' => 'S/ 4 850.00',
        'servicio' => 'Machu Picchu full day',
        'hora' => '05:30',
        'enlace' => 'https://andes.kipucontrol.local/portal',
        'agencia' => 'Andes Horizonte',
        'vendedor' => 'Lucía Paredes',
        'documentos' => "\n- Ana Torres: pasaporte (vencido)\n- Luis Torres: seguro de viaje",
    ];

    public const MESSAGES = [
        'cotizacion.enviada' => 'Te enviamos la cotización {{cotizacion}}. Revísala y apruébala aquí: {{enlace}}',
        'cotizacion.aprobada' => '{{cliente}} aprobó la cotización {{cotizacion}} por {{monto}}.',
        'reserva.confirmada' => 'Tu reserva {{reserva}} está confirmada para el {{fecha_viaje}}.',
        'pago.recibido' => 'Recibimos tu pago de {{monto}} para la reserva {{reserva}}. Gracias.',
        'asignacion.creada' => 'Tienes un servicio asignado: {{servicio}} el {{fecha_viaje}} a las {{hora}}.',
        'servicio.cambio_horario' => 'Cambió el horario de {{servicio}}: ahora es el {{fecha_viaje}} a las {{hora}}.',
        'incidencia.critica' => 'Incidencia crítica en {{servicio}} ({{reserva}}). Revísala de inmediato: {{enlace}}',
        'voucher.emitido' => 'Ya está disponible el voucher de {{servicio}} para la reserva {{reserva}}: {{enlace}}',
        'servicio.inicio' => '{{servicio}} comienza el {{fecha_viaje}} a las {{hora}}. Te esperamos.',
        'viaje.cierre' => 'Gracias por viajar con {{agencia}}. Cuéntanos cómo te fue: {{enlace}}',
        'pago.recordatorio' => 'Te recordamos el pago pendiente de {{monto}} de tu reserva {{reserva}}. Tu viaje empieza el {{fecha_viaje}}.',
        'estado_cuenta.enviado' => 'Te compartimos el estado de cuenta de tu reserva {{reserva}}: el saldo pendiente es {{monto}}.',
        'documentos.recordatorio' => 'Para tu viaje del {{fecha_viaje}} (reserva {{reserva}}) aún faltan documentos de los pasajeros. Complétalos aquí: {{enlace}}',
        'documentos.solicitud' => "Para preparar tu viaje del {{fecha_viaje}} (reserva {{reserva}}) necesitamos estos documentos:\n{{documentos}}\n\nPuedes subirlos aquí: {{enlace}}",
        'viaje.proximo' => 'Tu viaje de la reserva {{reserva}} comienza el {{fecha_viaje}}. Revisa tus documentos y el punto de encuentro.',
    ];

    public static function exists(string $code): bool
    {
        return isset(self::EVENTS[$code]) || isset(self::SYSTEM_EVENTS[$code]);
    }

    public static function render(string $text, array $values = self::SAMPLE): string
    {
        return (string) preg_replace_callback('/\{\{\s*([a-z_]+)\s*\}\}/', fn (array $m): string => (string) ($values[$m[1]] ?? $m[0]), $text);
    }

    public static function unknownVariables(string ...$texts): array
    {
        preg_match_all('/\{\{\s*([^}]*?)\s*\}\}/', implode("\n", $texts), $matches);

        return array_values(array_unique(array_diff($matches[1], self::VARIABLES)));
    }

    public static function label(string $code): string
    {
        return self::EVENTS[$code]['label'] ?? self::SYSTEM_EVENTS[$code] ?? $code;
    }
}
