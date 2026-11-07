<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Support\TenantNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class WarnExpiringCards extends PlatformJob
{
    public const QUEUE = 'low';

    protected function run(): string
    {
        $db = DB::connection('pgsql_platform');
        $today = Carbon::parse($this->today()->toDateString(), 'America/Lima');
        $limit = $today->copy()->addDays(30);
        $expired = 0;
        $warned = 0;

        foreach ($db->table('payment_methods')->where('status', 'active')->orderBy('tenant_id')->get(['id', 'tenant_id', 'brand', 'last4', 'exp_month', 'exp_year', 'is_default']) as $card) {
            $end = Carbon::create((int) $card->exp_year, (int) $card->exp_month, 1, 0, 0, 0, 'America/Lima')->endOfMonth();

            if ($end->lt($today)) {
                $db->table('payment_methods')->where('id', $card->id)->update(['status' => 'expired']);
                $expired++;
                $warned += app(TenantNotice::class)->send((string) $card->tenant_id, 'Tu tarjeta venció', "La tarjeta {$card->brand} terminada en {$card->last4} venció. Registra una nueva para que el cobro de tu suscripción no falle.") ? 1 : 0;

                continue;
            }

            if ($card->is_default && $end->lte($limit)) {
                $warned += app(TenantNotice::class)->send((string) $card->tenant_id, 'Tu tarjeta vence pronto', "La tarjeta {$card->brand} terminada en {$card->last4} vence a fin de {$end->locale('es')->translatedFormat('F Y')}. Actualízala para que el próximo cobro no falle.") ? 1 : 0;
            }
        }

        return self::summary([
            $warned ? self::plural($warned, 'aviso de tarjeta', 'avisos de tarjeta') : null,
            $expired ? self::plural($expired, 'tarjeta marcada como vencida', 'tarjetas marcadas como vencidas') : null,
        ], 'Sin tarjetas por vencer');
    }
}
