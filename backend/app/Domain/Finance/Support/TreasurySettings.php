<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TreasurySettings
{
    public const DEFAULTS = [
        'petty_tolerance' => 10.0,
        'max_petty_expense' => 500.0,
        'sworn_statement_max' => 150.0,
        'replenish_threshold_pct' => 40,
        'gateway_fee_pct' => 4.0,
        'cash_deposit_hours' => 24,
        'margin_target_pct' => 25.0,
        'margin_floor_pct' => 15.0,
    ];

    private const LABELS = [
        'petty_tolerance' => 'tolerancia del arqueo',
        'max_petty_expense' => 'máximo por gasto',
        'sworn_statement_max' => 'tope de declaración jurada',
        'replenish_threshold_pct' => 'umbral de reposición',
        'gateway_fee_pct' => 'comisión de la pasarela',
        'cash_deposit_hours' => 'plazo de depósito',
        'margin_target_pct' => 'meta de margen',
        'margin_floor_pct' => 'margen mínimo',
        'recurring_outflows' => 'egresos fijos',
        'payment_routing' => 'cuenta de cada medio de pago',
    ];

    public function __construct(private readonly TenantContext $context, private readonly AuditLogger $audit, private readonly TreasuryRouting $routing) {}

    public function current(): array
    {
        $row = DB::table('fin_treasury_settings as s')->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')->first(['s.*', 'u.name as updated_name']);
        $values = [];

        foreach (self::DEFAULTS as $key => $default) {
            $values[$key] = is_int($default) ? (int) ($row->{$key} ?? $default) : (float) ($row->{$key} ?? $default);
        }

        return [
            ...$values,
            'recurring_outflows' => collect(json_decode((string) ($row->recurring_outflows ?? '[]'), true) ?: [])
                ->map(fn (array $item): array => ['concept' => (string) $item['concept'], 'amount' => (float) $item['amount'], 'day' => (int) $item['day']])
                ->sortBy('day')->values()->all(),
            'payment_routing' => $this->routing->rules(),
            'routing_banks' => $this->routing->banks(),
            'lock_version' => (int) ($row->lock_version ?? 0),
            'updated_at' => $row->updated_at ?? null,
            'updated_by' => $row->updated_name ?? null,
        ];
    }

    public static function margins(): array
    {
        $row = DB::table('fin_treasury_settings')->first(['margin_target_pct', 'margin_floor_pct']);

        return ['target' => (float) ($row->margin_target_pct ?? self::DEFAULTS['margin_target_pct']), 'floor' => (float) ($row->margin_floor_pct ?? self::DEFAULTS['margin_floor_pct'])];
    }

    public function update(array $data, ?int $lockVersion, User $actor): array
    {
        return DB::transaction(function () use ($data, $lockVersion, $actor): array {
            $row = DB::table('fin_treasury_settings')->lockForUpdate()->first();
            $before = $this->current();

            if ($row !== null && $lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $row->lock_version, 'La configuración de tesorería');
            }

            $values = collect($data)->only([...array_keys(self::DEFAULTS), 'recurring_outflows', 'payment_routing'])->all();
            if (array_key_exists('payment_routing', $values)) {
                $values['payment_routing'] = json_encode($this->routing->normalize($values['payment_routing']), JSON_UNESCAPED_UNICODE);
            }
            if (array_key_exists('recurring_outflows', $values)) {
                $values['recurring_outflows'] = json_encode(array_values(array_map(fn (array $item): array => ['concept' => trim((string) $item['concept']), 'amount' => round((float) $item['amount'], 2), 'day' => (int) $item['day']], $values['recurring_outflows'])), JSON_UNESCAPED_UNICODE);
            }

            if ($row === null) {
                DB::table('fin_treasury_settings')->insert([
                    ...self::DEFAULTS,
                    'recurring_outflows' => '[]',
                    ...$values,
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->context->idOrFail(),
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('fin_treasury_settings')->where('id', $row->id)->update([...$values, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $after = $this->current();
            $changed = collect(self::LABELS)->filter(fn (string $label, string $key): bool => json_encode($before[$key]) !== json_encode($after[$key]));
            $this->audit->log('Configuración de tesorería', 'tesoreria', 'editar', $changed->keys()->map(fn (string $key): string => self::LABELS[$key].': '.$this->display($key, $before[$key]))->implode(' · ') ?: null, $changed->keys()->map(fn (string $key): string => self::LABELS[$key].': '.$this->display($key, $after[$key]))->implode(' · ') ?: 'sin cambios');

            return $after;
        });
    }

    private function display(string $key, mixed $value): string
    {
        if ($key === 'payment_routing') {
            return collect($value)->map(fn (array $rule): string => $rule['label'].' → '.match ($rule['destination']) {
                'bank' => trim("{$rule['bank']} ".($rule['currency'] ?? '')),
                'gateway' => 'pasarela',
                'petty_cash' => 'caja chica',
                default => 'sin movimiento',
            })->implode(', ');
        }

        return is_array($value) ? count($value).' egresos' : (string) $value;
    }
}
