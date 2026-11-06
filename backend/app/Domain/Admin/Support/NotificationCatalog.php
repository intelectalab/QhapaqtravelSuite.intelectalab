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
    ];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'push' => 'Push', 'portal' => 'Portal'];

    public const TIMINGS = ['immediate' => 'Inmediato', 'batch_15m' => 'Agrupado cada 15 min', 'business_hours' => 'Solo en horario laboral (08:00 a 19:00)'];

    public const CONDITIONS = ['always' => 'Siempre', 'marketing_consent' => 'Solo con consentimiento de marketing', 'amount_gt_5000' => 'Solo si el monto supera S/ 5 000'];

    public static function label(string $code): string
    {
        return self::EVENTS[$code]['label'] ?? self::SYSTEM_EVENTS[$code] ?? $code;
    }
}
