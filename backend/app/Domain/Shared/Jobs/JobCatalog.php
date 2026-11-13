<?php

declare(strict_types=1);

namespace App\Domain\Shared\Jobs;

use App\Jobs\AlertClaimDeadlines;
use App\Jobs\ApprovalSlaCheck;
use App\Jobs\CashDepositAlerts;
use App\Jobs\CatalogValidityAlerts;
use App\Jobs\CloseTrials;
use App\Jobs\ConsolidateUsage;
use App\Jobs\DetectPendingSupplierServices;
use App\Jobs\DispatchScheduledCampaigns;
use App\Jobs\EvaluateMinimumGroup;
use App\Jobs\ExpireApiKeys;
use App\Jobs\ExpireAvailabilityHolds;
use App\Jobs\ExpireInTripOffers;
use App\Jobs\ExpireQuotes;
use App\Jobs\ExpireSupplierAlternativeHolds;
use App\Jobs\ExpireUnconfirmedAssignments;
use App\Jobs\ExpireWidgetHandoffs;
use App\Jobs\InboxFirstResponseSla;
use App\Jobs\MaintainMonthlyPartitions;
use App\Jobs\MarkExpiredProviderContracts;
use App\Jobs\MarkOverdueReceivables;
use App\Jobs\MonitorIncidentSla;
use App\Jobs\NotifyUpcomingTrips;
use App\Jobs\PurgeWebhookDeliveries;
use App\Jobs\RelayOutbox;
use App\Jobs\ReleaseAllotments;
use App\Jobs\ReleaseDueAlerts;
use App\Jobs\ReleasePayLaterHolds;
use App\Jobs\RemindCrmActivities;
use App\Jobs\RemindPendingSupplierRequests;
use App\Jobs\RemindTravelDocuments;
use App\Jobs\RenewSubscriptions;
use App\Jobs\ResourceDocumentAlerts;
use App\Jobs\RetryFailedCharges;
use App\Jobs\RetryIntegrationErrors;
use App\Jobs\RunAutomations;
use App\Jobs\SchedulePaxMessages;
use App\Jobs\SendDueReviewRequests;
use App\Jobs\SendPaymentReminders;
use App\Jobs\SendScheduledReports;
use App\Jobs\SnapshotPlatformMetrics;
use App\Jobs\SyncSupplierAdapters;
use App\Jobs\TreasuryCashFlowSnapshot;
use App\Jobs\TreasuryOpenSessionCheck;
use App\Jobs\VoucherDeadlineAlerts;
use App\Jobs\WarnExpiringCards;

final class JobCatalog
{
    public const TENANT = [
        'JOB-01' => ['class' => ExpireAvailabilityHolds::class, 'name' => 'Expirar holds de disponibilidad', 'cron' => '*/5 * * * *', 'label' => 'cada 5 min', 'queue' => 'critical'],
        'JOB-02' => ['class' => ExpireQuotes::class, 'name' => 'Marcar cotizaciones vencidas', 'cron' => '5 0 * * *', 'label' => 'diario 00:05', 'queue' => 'default'],
        'JOB-03' => ['class' => SendPaymentReminders::class, 'name' => 'Recordatorios de pago', 'cron' => '0 9 * * *', 'label' => 'diario 09:00', 'queue' => 'notifications'],
        'JOB-04' => ['class' => RemindCrmActivities::class, 'name' => 'Recordatorio de actividades CRM', 'cron' => '0 * * * *', 'label' => 'cada hora', 'queue' => 'notifications'],
        'JOB-05' => ['class' => NotifyUpcomingTrips::class, 'name' => 'Notificar próximos viajes (48 h)', 'cron' => '0 5 * * *', 'label' => 'diario 05:00', 'queue' => 'notifications'],
        'JOB-06' => ['class' => DetectPendingSupplierServices::class, 'name' => 'Detectar reservas pendientes de proveedor', 'cron' => '0 */2 * * *', 'label' => 'cada 2 h', 'queue' => 'default'],
        'JOB-07' => ['class' => SyncSupplierAdapters::class, 'name' => 'Sincronizar proveedores (adapters)', 'cron' => '0 */6 * * *', 'label' => 'cada 6 h', 'queue' => 'integrations'],
        'JOB-08' => ['class' => SendScheduledReports::class, 'name' => 'Reportes programados (gerencia)', 'cron' => '0 7 * * 1', 'label' => 'lunes 07:00', 'queue' => 'reports'],
        'JOB-09' => ['class' => ExpireUnconfirmedAssignments::class, 'name' => 'Expirar asignaciones no confirmadas', 'cron' => '*/30 * * * *', 'label' => 'cada 30 min', 'queue' => 'default'],
        'JOB-10' => ['class' => ReleaseAllotments::class, 'name' => 'Liberar cupos en release (allotments)', 'cron' => '15 0 * * *', 'label' => 'diario 00:15', 'queue' => 'default'],
        'JOB-11' => ['class' => RemindTravelDocuments::class, 'name' => 'Recordatorio de documentos de viaje', 'cron' => '0 8 * * *', 'label' => 'diario 08:00', 'queue' => 'notifications'],
        'JOB-12' => ['class' => MarkOverdueReceivables::class, 'name' => 'Marcar cuentas por cobrar vencidas', 'cron' => '5 0 * * *', 'label' => 'diario 00:05', 'queue' => 'low'],
        'JOB-13' => ['class' => RelayOutbox::class, 'name' => 'Publicar eventos del outbox', 'cron' => '* * * * *', 'label' => 'cada minuto', 'queue' => 'integrations'],
        'JOB-14' => ['class' => MarkExpiredProviderContracts::class, 'name' => 'Vencer contratos de proveedores', 'cron' => '10 0 * * *', 'label' => 'diario 00:10', 'queue' => 'default'],
        'JOB-15' => ['class' => AlertClaimDeadlines::class, 'name' => 'Plazos del Libro de Reclamaciones', 'cron' => '0 8 * * *', 'label' => 'diario 08:00', 'queue' => 'notifications'],
        'JOB-16' => ['class' => MonitorIncidentSla::class, 'name' => 'SLA de incidencias', 'cron' => '*/5 * * * *', 'label' => 'cada 5 min', 'queue' => 'critical'],
        'JOB-17' => ['class' => ExpireSupplierAlternativeHolds::class, 'name' => 'Vencer alternativas de proveedores', 'cron' => '20 0 * * *', 'label' => 'diario 00:20', 'queue' => 'default'],
        'JOB-18' => ['class' => SchedulePaxMessages::class, 'name' => 'Programar y enviar mensajes al pasajero', 'cron' => '*/15 * * * *', 'label' => 'cada 15 min', 'queue' => 'notifications'],
        'JOB-19' => ['class' => ReleasePayLaterHolds::class, 'name' => 'Liberar reservas de pagar después', 'cron' => '*/5 * * * *', 'label' => 'cada 5 min', 'queue' => 'critical'],
        'JOB-20' => ['class' => SendDueReviewRequests::class, 'name' => 'Enviar invitaciones a reseñar', 'cron' => '*/15 * * * *', 'label' => 'cada 15 min', 'queue' => 'notifications'],
        'JOB-21' => ['class' => ExpireWidgetHandoffs::class, 'name' => 'Vencer traspasos del widget', 'cron' => '0 * * * *', 'label' => 'cada hora', 'queue' => 'low'],
        'JOB-22' => ['class' => DispatchScheduledCampaigns::class, 'name' => 'Enviar campañas programadas', 'cron' => '* * * * *', 'label' => 'cada minuto', 'queue' => 'default'],
        'JOB-23' => ['class' => ReleaseDueAlerts::class, 'name' => 'Avisar releases de cupos próximos', 'cron' => '0 7 * * *', 'label' => 'diario 07:00', 'queue' => 'notifications'],
        'JOB-24' => ['class' => ResourceDocumentAlerts::class, 'name' => 'Licencias y SOAT por vencer', 'cron' => '30 7 * * *', 'label' => 'diario 07:30', 'queue' => 'notifications'],
        'JOB-25' => ['class' => CatalogValidityAlerts::class, 'name' => 'Contratos, servicios y tarifas por vencer', 'cron' => '45 7 * * *', 'label' => 'diario 07:45', 'queue' => 'notifications'],
        'JOB-26' => ['class' => RemindPendingSupplierRequests::class, 'name' => 'Recordar solicitudes a proveedores', 'cron' => '0 9,15 * * *', 'label' => 'diario 09:00 y 15:00', 'queue' => 'notifications'],
        'JOB-27' => ['class' => ApprovalSlaCheck::class, 'name' => 'Plazos de aprobaciones', 'cron' => '*/15 * * * *', 'label' => 'cada 15 min', 'queue' => 'notifications'],
        'JOB-28' => ['class' => InboxFirstResponseSla::class, 'name' => 'Primera respuesta de la bandeja', 'cron' => '*/5 * * * *', 'label' => 'cada 5 min', 'queue' => 'notifications'],
        'JOB-29' => ['class' => RunAutomations::class, 'name' => 'Ejecutar automatizaciones de marketing', 'cron' => '15 * * * *', 'label' => 'cada hora', 'queue' => 'notifications'],
        'JOB-32' => ['class' => VoucherDeadlineAlerts::class, 'name' => 'Servicios próximos sin voucher', 'cron' => '0 8 * * *', 'label' => 'diario 08:00', 'queue' => 'notifications'],
        'JOB-31' => ['class' => CashDepositAlerts::class, 'name' => 'Efectivo sin depositar', 'cron' => '0 10 * * *', 'label' => 'diario 10:00', 'queue' => 'notifications'],
        'JOB-30' => ['class' => EvaluateMinimumGroup::class, 'name' => 'Evaluar grupo mínimo de salidas', 'cron' => '0 6 * * *', 'label' => 'diario 06:00', 'queue' => 'default'],
        'JOB-33' => ['class' => RetryIntegrationErrors::class, 'name' => 'Reintentar errores de integración', 'cron' => '*/5 * * * *', 'label' => 'cada 5 min', 'queue' => 'integrations'],
        'JOB-TES-1' => ['class' => TreasuryOpenSessionCheck::class, 'name' => 'Cajas chicas sin abrir', 'cron' => '0 10 * * *', 'label' => 'diario 10:00', 'queue' => 'low'],
        'JOB-TES-2' => ['class' => TreasuryCashFlowSnapshot::class, 'name' => 'Foto del flujo de caja proyectado', 'cron' => '0 6 * * *', 'label' => 'diario 06:00', 'queue' => 'reports'],
        'JOB-TRAMOS-1' => ['class' => ExpireInTripOffers::class, 'name' => 'Vencer ofertas de venta en ruta', 'cron' => '*/15 * * * *', 'label' => 'cada 15 min', 'queue' => 'default'],
    ];

    public const PLATFORM = [
        'PLT-01' => ['class' => RenewSubscriptions::class, 'name' => 'Renovar suscripciones', 'cron' => '0 6 * * *', 'label' => 'diario 06:00', 'queue' => 'critical'],
        'PLT-02' => ['class' => RetryFailedCharges::class, 'name' => 'Reintentar cobros fallidos', 'cron' => '0 10 * * *', 'label' => 'diario 10:00', 'queue' => 'critical'],
        'PLT-03' => ['class' => CloseTrials::class, 'name' => 'Avisos y cierre de pruebas', 'cron' => '0 8 * * *', 'label' => 'diario 08:00', 'queue' => 'default'],
        'PLT-04' => ['class' => WarnExpiringCards::class, 'name' => 'Tarjetas por vencer', 'cron' => '0 9 1 * *', 'label' => 'mensual, día 1', 'queue' => 'low'],
        'PLT-05' => ['class' => ConsolidateUsage::class, 'name' => 'Consolidar uso', 'cron' => '15 0 * * *', 'label' => 'diario 00:15', 'queue' => 'reports'],
        'PLT-06' => ['class' => SnapshotPlatformMetrics::class, 'name' => 'Foto de métricas', 'cron' => '0 1 * * *', 'label' => 'diario 01:00', 'queue' => 'reports'],
        'PLT-07' => ['class' => ExpireApiKeys::class, 'name' => 'Vencer llaves de API', 'cron' => '30 0 * * *', 'label' => 'diario 00:30', 'queue' => 'low'],
        'PLT-08' => ['class' => PurgeWebhookDeliveries::class, 'name' => 'Depurar entregas de webhooks', 'cron' => '45 0 * * *', 'label' => 'diario 00:45', 'queue' => 'low'],
        'PLT-09' => ['class' => MaintainMonthlyPartitions::class, 'name' => 'Crear particiones mensuales', 'cron' => '30 1 1 * *', 'label' => 'mensual, día 1 01:30', 'queue' => 'low'],
    ];

    public static function forClass(string $class): ?array
    {
        foreach ([...self::TENANT, ...self::PLATFORM] as $code => $job) {
            if ($job['class'] === $class) {
                return ['code' => $code, ...$job];
            }
        }

        return null;
    }
}
