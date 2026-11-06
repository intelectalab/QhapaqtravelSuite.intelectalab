<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class LocalGateway
{
    private const CONNECTION = 'pgsql_platform';

    private const MESSAGES = [
        'insufficient_funds' => 'Fondos insuficientes (51)',
        'expired_card' => 'Tarjeta vencida (54)',
        'card_declined' => 'Tarjeta rechazada por el emisor (05)',
        'no_payment_method' => 'La agencia no tiene una tarjeta registrada',
    ];

    public function charge(object $invoice): array
    {
        $db = DB::connection(self::CONNECTION);
        $method = $db->table('payment_methods')->where('tenant_id', $invoice->tenant_id)->where('is_default', true)->first();

        if ($method === null || $method->status === 'removed') {
            return $this->declined('no_payment_method', null);
        }

        if ($method->status === 'expired') {
            return $this->declined('expired_card', $method);
        }

        $last = $db->table('payment_attempts')->where('invoice_id', $invoice->id)->where('result', '<>', 'succeeded')->orderByDesc('created_at')->first();

        if ($last !== null && Carbon::parse($method->created_at)->lessThanOrEqualTo(Carbon::parse($last->created_at))) {
            return $this->declined((string) ($last->gateway_code ?: 'card_declined'), $method);
        }

        return ['result' => 'succeeded', 'code' => '00', 'message' => 'Aprobado', 'method' => $this->label($method)];
    }

    public function label(?object $method): ?string
    {
        return $method ? trim("{$method->brand} •••• {$method->last4}") : null;
    }

    private function declined(string $code, ?object $method): array
    {
        return ['result' => 'declined', 'code' => $code, 'message' => self::MESSAGES[$code] ?? 'Cobro rechazado', 'method' => $this->label($method)];
    }
}
