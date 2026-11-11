<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Actions\ManagePaxMessages;
use App\Domain\Admin\Actions\PaxMessageScheduler;

final class SchedulePaxMessages extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $plan = app(PaxMessageScheduler::class)->run();
        $sent = app(ManagePaxMessages::class)->dispatchDue();
        $summary = self::plural($plan['scheduled'], 'mensaje programado', 'mensajes programados')
            .' · '.self::plural($sent['sent'], 'enviado', 'enviados')
            .($plan['cancelled'] > 0 ? ' · '.self::plural($plan['cancelled'], 'retirado', 'retirados') : '');

        if ($plan['disabled']) {
            return $this->warn('Mensajes automáticos apagados (R-PAX-MESSAGES) · '.$summary);
        }

        return $sent['failed'] > 0 ? $this->warn($summary.' · '.self::plural($sent['failed'], 'fallido', 'fallidos')) : $summary;
    }
}
