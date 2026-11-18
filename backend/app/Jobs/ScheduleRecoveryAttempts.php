<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Growth\Recovery\RecoveryDispatcher;

final class ScheduleRecoveryAttempts extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $result = app(RecoveryDispatcher::class)->run();

        if ($result === null) {
            return 'La recuperación de ventas no está activa en el plan de la agencia';
        }

        $summary = self::summary([
            $result['scheduled'] > 0 ? self::plural($result['scheduled'], 'intento programado', 'intentos programados') : null,
            $result['sent'] > 0 ? self::plural($result['sent'], 'enviado', 'enviados') : null,
            $result['recovered'] > 0 ? self::plural($result['recovered'], 'venta recuperada', 'ventas recuperadas') : null,
            $result['discarded'] + $result['skipped'] > 0 ? self::plural($result['discarded'] + $result['skipped'], 'descartado', 'descartados') : null,
        ], 'Sin carritos ni cotizaciones por recuperar');

        return $result['failed'] > 0 ? $this->warn($summary.' · '.self::plural($result['failed'], 'envío fallido', 'envíos fallidos')) : $summary;
    }
}
