<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Site\Actions\WidgetHandoffs;

final class ExpireWidgetHandoffs extends TenantJob
{
    public const QUEUE = 'low';

    protected function run(): string
    {
        $expired = WidgetHandoffs::expire();

        return $expired === 0 ? 'Sin traspasos del widget vencidos' : self::plural($expired, 'traspaso vencido', 'traspasos vencidos');
    }
}
