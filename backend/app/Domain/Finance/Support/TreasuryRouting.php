<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TreasuryRouting
{
    public const DESTINATIONS = ['bank', 'gateway', 'petty_cash', 'none'];

    private const DEFAULTS = [
        'tarjeta' => ['destination' => 'gateway', 'bank' => null, 'currency' => null],
        'tarjeta_pasarela' => ['destination' => 'gateway', 'bank' => null, 'currency' => null],
        'tarjeta_e_commerce' => ['destination' => 'gateway', 'bank' => null, 'currency' => null],
        'yape' => ['destination' => 'bank', 'bank' => 'BCP', 'currency' => 'PEN'],
        'plin' => ['destination' => 'bank', 'bank' => 'Interbank', 'currency' => 'PEN'],
        'transferencia_interbank' => ['destination' => 'bank', 'bank' => 'Interbank', 'currency' => null],
        'transferencia_bbva' => ['destination' => 'bank', 'bank' => 'BBVA', 'currency' => null],
        'transferencia_bcp' => ['destination' => 'bank', 'bank' => 'BCP', 'currency' => null],
        'efectivo' => ['destination' => 'petty_cash', 'bank' => null, 'currency' => null],
    ];

    private const FALLBACK = ['destination' => 'bank', 'bank' => 'BCP', 'currency' => null];

    private const KINDS = ['bank' => 'bank', 'gateway' => 'gateway', 'petty_cash' => 'petty_cash'];

    private ?Collection $accounts = null;

    public static function defaultFor(string $method): array
    {
        return self::DEFAULTS[$method] ?? self::FALLBACK;
    }

    public function rules(): array
    {
        $stored = $this->stored();

        return DB::table('fin_payment_methods')->where('active', true)->orderBy('label')->get(['code', 'label', 'is_b2b_credit'])
            ->map(function (object $method) use ($stored): array {
                $rule = $this->ruleFor((string) $method->code, (bool) $method->is_b2b_credit, $stored);

                return [
                    'method' => (string) $method->code,
                    'label' => (string) $method->label,
                    'b2b' => (bool) $method->is_b2b_credit,
                    'destination' => (string) $rule['destination'],
                    'bank' => $rule['destination'] === 'bank' ? $rule['bank'] : null,
                    'currency' => $rule['destination'] === 'bank' ? $rule['currency'] : null,
                    'accounts' => [
                        'PEN' => $this->resolve($rule, 'PEN', null)->name ?? null,
                        'USD' => $this->resolve($rule, 'USD', null)->name ?? null,
                    ],
                ];
            })->values()->all();
    }

    public function normalize(array $rows): array
    {
        $methods = DB::table('fin_payment_methods')->pluck('is_b2b_credit', 'code');
        $banks = collect($this->banks())->mapWithKeys(fn (string $bank): array => [mb_strtolower($bank) => $bank]);
        $stored = $this->stored();

        foreach ($rows as $row) {
            $stored->put((string) $row['method'], $this->validRule($row, $methods, $banks));
        }

        return $stored->values()->all();
    }

    private function validRule(array $row, Collection $methods, Collection $banks): array
    {
        $method = (string) $row['method'];

        if (! $methods->has($method)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Ese medio de pago no existe en la agencia.', ['payment_routing' => ['Revisa los medios de pago.']]);
        }

        if ((bool) $methods->get($method) && $row['destination'] !== 'none') {
            throw ApiException::unprocessable('TES-BR-04', 'El crédito B2B no mueve caja: no se le asigna una cuenta.', ['payment_routing' => ['El crédito B2B no genera movimiento.']]);
        }

        $bank = $row['destination'] === 'bank' ? $banks->get(mb_strtolower((string) ($row['bank'] ?? ''))) : null;

        if ($row['destination'] === 'bank' && $bank === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un banco donde la agencia tenga una cuenta activa.', ['payment_routing' => ['Elige un banco con cuenta activa.']]);
        }

        return ['method' => $method, 'destination' => (string) $row['destination'], 'bank' => $bank, 'currency' => $row['destination'] === 'bank' ? ($row['currency'] ?? null) : null];
    }

    public function banks(): array
    {
        return $this->accounts()->where('kind', 'bank')->pluck('bank')->filter()->unique()->sort()->values()->all();
    }

    public function forPayment(object $payment, ?string $sedeId): ?object
    {
        $b2b = (bool) DB::table('fin_payment_methods')->where('code', $payment->method)->value('is_b2b_credit');

        return $this->resolve($this->ruleFor((string) $payment->method, $b2b, $this->stored()), (string) $payment->currency, $sedeId);
    }

    private function ruleFor(string $method, bool $b2b, Collection $stored): array
    {
        if ($b2b) {
            return ['destination' => 'none', 'bank' => null, 'currency' => null];
        }

        return [...self::defaultFor($method), ...array_intersect_key((array) $stored->get($method, []), self::FALLBACK)];
    }

    private function stored(): Collection
    {
        return collect(json_decode((string) (DB::table('fin_treasury_settings')->value('payment_routing') ?? '[]'), true) ?: [])->keyBy('method');
    }

    public function forPayout(object $payout, string $currency, ?string $sedeId): ?object
    {
        if ($payout->method === 'efectivo_caja_chica') {
            return $this->resolve(['destination' => 'petty_cash', 'bank' => null, 'currency' => null], $currency, $sedeId);
        }

        if ($payout->bank_account_id !== null) {
            $account = $this->accounts()->firstWhere('id', $payout->bank_account_id);
            if ($account !== null) {
                return $account;
            }
        }

        return $this->accounts()->where('kind', 'bank')->firstWhere('currency', $currency) ?? $this->accounts()->firstWhere('kind', 'bank');
    }

    private function resolve(array $rule, string $currency, ?string $sedeId): ?object
    {
        $kind = self::KINDS[$rule['destination']] ?? null;

        if ($kind === null) {
            return null;
        }

        $pool = $this->accounts()->where('kind', $kind);

        if ($kind === 'petty_cash') {
            return ($sedeId !== null ? $pool->firstWhere('sede_id', $sedeId) : null) ?? $pool->first();
        }

        if ($kind === 'bank' && filled($rule['bank'])) {
            $bank = $pool->filter(fn (object $account): bool => mb_strtolower((string) $account->bank) === mb_strtolower((string) $rule['bank']));
            $wanted = $rule['currency'] ?: $currency;
            $match = $bank->firstWhere('currency', $wanted) ?? $bank->firstWhere('currency', 'PEN');
            if ($match !== null) {
                return $match;
            }
        }

        return $pool->firstWhere('currency', $rule['currency'] ?: $currency) ?? $pool->first();
    }

    private function accounts(): Collection
    {
        return $this->accounts ??= DB::table('fin_treasury_accounts')->whereNull('deleted_at')->where('status', 'active')->orderBy('code')
            ->get(['id', 'code', 'name', 'kind', 'bank', 'currency', 'sede_id']);
    }
}
