<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RegisterFxRate
{
    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function __invoke(array $data, User $actor): void
    {
        $code = $data['currency'];
        $rate = Decimal::of($data['rate'])->toScale(6, RoundingMode::HALF_UP);
        $date = $data['rate_date'] ?? Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
        $previous = DB::table('fin_fx_rates')->where('currency_code', $code)->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);

        if ($previous && Decimal::of($previous->rate_pen)->isEqualTo($rate) && $previous->rate_date === $date) {
            throw ApiException::conflict('CFG-BR-06', 'Ese tipo de cambio ya está registrado para la fecha.');
        }

        if (isset($data['buy'], $data['sell']) && Decimal::of($data['buy'])->isGreaterThan(Decimal::of($data['sell']))) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El precio de compra no puede ser mayor que el de venta.');
        }

        DB::table('fin_fx_rates')->insert([
            'currency_code' => $code,
            'base_currency' => 'PEN',
            'rate_pen' => (string) $rate,
            'buy' => $data['buy'] ?? null,
            'sell' => $data['sell'] ?? null,
            'previous_rate' => $previous?->rate_pen,
            'rate_date' => $date,
            'source' => $data['source'],
            'effective_at' => now()->format('Y-m-d H:i:s.uP'),
            'created_by' => $actor->getKey(),
        ]);

        $this->audit->log('Tipo de cambio', $code, 'registrar', $previous ? (string) $previous->rate_pen : null, "{$rate->strippedOfTrailingZeros()} · {$date} · {$data['source']}");
    }
}
