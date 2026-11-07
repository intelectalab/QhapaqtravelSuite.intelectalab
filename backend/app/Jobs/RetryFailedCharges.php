<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Actions\CollectInvoice;

final class RetryFailedCharges extends PlatformJob
{
    public const QUEUE = 'critical';

    protected function run(): string
    {
        $summary = app(CollectInvoice::class)->runDunning();

        if ($summary['processed'] === 0) {
            return 'Sin facturas con reintento pendiente';
        }

        $text = self::summary([
            self::plural($summary['processed'], 'reintento', 'reintentos'),
            $summary['paid'] ? self::plural($summary['paid'], 'cobrada', 'cobradas') : null,
            $summary['declined'] ? self::plural($summary['declined'], 'rechazada', 'rechazadas') : null,
            $summary['suspended'] ? self::plural($summary['suspended'], 'agencia suspendida', 'agencias suspendidas') : null,
        ], '');

        return $summary['declined'] > 0 ? $this->warn($text) : $text;
    }
}
