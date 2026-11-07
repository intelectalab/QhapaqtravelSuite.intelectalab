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
        'viaje.proximo' => 'Viaje próximo',
        'cotizacion.vista' => 'Cotización abierta por el cliente',
        'pago.recordatorio' => 'Recordatorio de pago',
        'integracion.fallo' => 'Falla de integración',
        'usuario.invitado' => 'Usuario invitado',
        'seguridad.mfa_reset' => 'Verificación en dos pasos reiniciada',
        'exportacion.lista' => 'Exportación lista',
        'reporte.programado' => 'Reporte programado enviado',
        'actividad.vencida' => 'Actividades vencidas',
        'documentos.recordatorio' => 'Recordatorio de documentos de viaje',
        'proveedor.contrato_vencido' => 'Contrato de proveedor vencido',
        'reclamacion.por_vencer' => 'Reclamo por vencer',
        'reclamacion.vencida' => 'Reclamo fuera de plazo',
        'incidencia.sla_vencido' => 'SLA de incidencia vencido',
    ];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'push' => 'Push', 'portal' => 'Portal'];

    public const TIMINGS = ['immediate' => 'Inmediato', 'batch_15m' => 'Agrupado cada 15 min', 'business_hours' => 'Solo en horario laboral (08:00 a 19:00)'];

    public const CONDITIONS = ['always' => 'Siempre', 'marketing_consent' => 'Solo con consentimiento de marketing', 'amount_gt_5000' => 'Solo si el monto supera S/ 5 000'];

    public const TEMPLATE_CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'push' => 'Push'];

    public const VARIABLES = ['cliente', 'reserva', 'cotizacion', 'fecha_viaje', 'monto', 'servicio', 'hora', 'enlace', 'agencia', 'vendedor'];

    public const SAMPLE = [
        'cliente' => 'Ana Torres',
        'reserva' => 'RES-2026-000350',
        'cotizacion' => 'COT-2026-00188',
        'fecha_viaje' => '12/10/2026',
        'monto' => 'S/ 4 850.00',
        'servicio' => 'Machu Picchu full day',
        'hora' => '05:30',
        'enlace' => 'https://andes.qhapaq.local/portal',
        'agencia' => 'Andes Horizonte',
        'vendedor' => 'Lucía Paredes',
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
        'documentos.recordatorio' => 'Para tu viaje del {{fecha_viaje}} (reserva {{reserva}}) aún faltan documentos de los pasajeros. Complétalos aquí: {{enlace}}',
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
