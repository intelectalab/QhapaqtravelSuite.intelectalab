<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Money\Decimal;
use App\Domain\Showcase\Actions\BillShowcaseFees;

final class ShowcaseMonthlyFees extends PlatformJob
{
    public const QUEUE = 'critical';

    protected function run(): string
    {
        $count = app(BillShowcaseFees::class)->run($this->today());
        $skipped = $count['no_account'] + $count['no_subscription'];

        $text = self::summary([
            $count['invoiced'] ? self::plural($count['invoiced'], 'agencia facturada', 'agencias facturadas').' por '.Decimal::display($count['total'], 'PEN') : null,
            $count['no_account'] ? self::plural($count['no_account'], 'agencia sin cuenta en KipuControl con cargos por cobrar', 'agencias sin cuenta en KipuControl con cargos por cobrar') : null,
            $count['no_subscription'] ? self::plural($count['no_subscription'], 'agencia sin suscripción con cargos por cobrar', 'agencias sin suscripción con cargos por cobrar') : null,
        ], 'Sin cargos de la vitrina por facturar');

        return $skipped > 0 ? $this->warn($text) : $text;
    }
}
