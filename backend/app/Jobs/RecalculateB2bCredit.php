<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Channels\Support\B2bRecipients;
use App\Domain\Shared\Money\Decimal;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Facades\DB;

final class RecalculateB2bCredit extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'low';

    protected function run(): string
    {
        $ledger = DB::table('channel_b2b_credit_movements')->groupBy('agency_id')->selectRaw('agency_id, sum(amount) as total')->pluck('total', 'agency_id');
        $agencies = DB::table('channel_b2b_agencies')->whereNull('deleted_at')->orderBy('code')->get(['id', 'code', 'legal_name', 'credit_currency', 'credit_used']);

        if ($agencies->isEmpty()) {
            return 'Sin agencias B2B';
        }

        $mismatched = $agencies->filter(fn (object $agency): bool => ! Decimal::round2((string) $agency->credit_used)->isEqualTo(Decimal::round2((string) ($ledger[$agency->id] ?? '0'))));

        if ($mismatched->isEmpty()) {
            return self::plural($agencies->count(), 'agencia con crédito cuadrado', 'agencias con crédito cuadrado');
        }

        $recipients = array_values(array_unique([...app(B2bRecipients::class)->executives(), ...$this->managers()]));

        foreach ($mismatched as $agency) {
            $used = Decimal::round2((string) $agency->credit_used);
            $sum = Decimal::round2((string) ($ledger[$agency->id] ?? '0'));
            $gap = $used->minus($sum);
            $currency = (string) $agency->credit_currency;

            foreach ($recipients as $userId) {
                $this->notifyOnce('b2b.credito_descuadrado', $userId, 'channel_b2b_agency', (string) $agency->id, "El crédito de {$agency->legal_name} no cuadra",
                    'El crédito usado figura en '.Decimal::display($used, $currency).', pero sus movimientos suman '.Decimal::display($sum, $currency).' (diferencia de '.Decimal::display($gap->abs(), $currency).'). Revisa los movimientos de la línea en Canales › B2B agencias antes de aprobar más crédito.', true);
            }
        }

        return $this->warn(self::plural($mismatched->count(), 'agencia con crédito descuadrado', 'agencias con crédito descuadrado').': '.$mismatched->pluck('code')->implode(', '));
    }
}
