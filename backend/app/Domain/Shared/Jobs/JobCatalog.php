<?php

declare(strict_types=1);

namespace App\Domain\Shared\Jobs;

use App\Jobs\AlertClaimDeadlines;
use App\Jobs\CloseTrials;
use App\Jobs\ConsolidateUsage;
use App\Jobs\DetectPendingSupplierServices;
use App\Jobs\ExpireApiKeys;
use App\Jobs\ExpireAvailabilityHolds;
use App\Jobs\ExpireQuotes;
use App\Jobs\ExpireUnconfirmedAssignments;
use App\Jobs\MaintainMonthlyPartitions;
use App\Jobs\MarkExpiredProviderContracts;
use App\Jobs\MarkOverdueReceivables;
use App\Jobs\MonitorIncidentSla;
use App\Jobs\NotifyUpcomingTrips;
use App\Jobs\PurgeWebhookDeliveries;
use App\Jobs\RelayOutbox;
use App\Jobs\ReleaseAllotments;
use App\Jobs\RemindCrmActivities;
use App\Jobs\RemindTravelDocuments;
use App\Jobs\RenewSubscriptions;
use App\Jobs\RetryFailedCharges;
use App\Jobs\SendPaymentReminders;
use App\Jobs\SendScheduledReports;
use App\Jobs\SnapshotPlatformMetrics;
use App\Jobs\SyncSupplierAdapters;
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
