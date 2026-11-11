<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Actions\ManageBookingRules;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageCurrencies
{
    public const BASE = 'PEN';

    public const DEFAULTS = [
        'PEN' => ['name' => 'Sol peruano', 'symbol' => 'S/', 'active' => true, 'charge' => true],
        'USD' => ['name' => 'Dólar estadounidense', 'symbol' => 'US$', 'active' => true, 'charge' => true],
        'EUR' => ['name' => 'Euro', 'symbol' => '€', 'active' => true, 'charge' => false],
        'GBP' => ['name' => 'Libra esterlina', 'symbol' => '£', 'active' => true, 'charge' => false],
        'BRL' => ['name' => 'Real brasileño', 'symbol' => 'R$', 'active' => true, 'charge' => false],
        'CLP' => ['name' => 'Peso chileno', 'symbol' => 'CLP$', 'active' => true, 'charge' => false],
        'MXN' => ['name' => 'Peso mexicano', 'symbol' => 'MX$', 'active' => true, 'charge' => false],
        'COP' => ['name' => 'Peso colombiano', 'symbol' => 'COL$', 'active' => true, 'charge' => false],
        'ARS' => ['name' => 'Peso argentino', 'symbol' => 'AR$', 'active' => false, 'charge' => false],
        'JPY' => ['name' => 'Yen japonés', 'symbol' => '¥', 'active' => false, 'charge' => false],
    ];

    public const MARGIN_DEFAULT = 2.0;

    public const ALERT_DEFAULT = 3.0;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantSettings $settings,
        private readonly ManageBookingRules $rules,
        private readonly TenantContext $context,
    ) {}

    public function all(): Collection
    {
        $this->ensure();

        return DB::table('fin_currencies')->orderByDesc('is_base')->orderByDesc('is_charge')->orderByDesc('active')->orderBy('code')->get(['code', 'name', 'symbol', 'active', 'is_base', 'is_charge', 'updated_at']);
    }

    public function settings(): array
    {
        $values = $this->settings->section('ecommerce');
        $params = (array) json_decode((string) DB::table('sys_booking_rules')->where('code', 'R-MULTICURRENCY')->value('params'), true);

        return [
            'margin_pct' => (float) ($params['fxMarginPct'] ?? $values['fxMarginPct'] ?? self::MARGIN_DEFAULT),
            'alert_pct' => (float) ($values['fxAlertPct'] ?? self::ALERT_DEFAULT),
            'multicurrency' => (bool) (DB::table('sys_booking_rules')->where('code', 'R-MULTICURRENCY')->value('enabled') ?? true),
        ];
    }

    public function update(string $code, array $data, User $actor): array
    {
        $this->ensure();

        return DB::transaction(function () use ($code, $data, $actor): array {
            $row = DB::table('fin_currencies')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La moneda no existe.');
            $active = array_key_exists('active', $data) ? (bool) $data['active'] : (bool) $row->active;
            $charge = array_key_exists('is_charge', $data) ? (bool) $data['is_charge'] : (bool) $row->is_charge;

            if ($row->is_base && (! $active || ! $charge)) {
                throw ApiException::unprocessable('FX-02', 'La moneda base siempre está activa y es de cobro.');
            }

            if ($charge && ! $active) {
                throw ApiException::unprocessable('FX-02', array_key_exists('is_charge', $data) ? 'Una moneda de cobro debe estar activa.' : 'Esta moneda es de cobro: quítala de las monedas de cobro antes de desactivarla.');
            }

            if ($active === (bool) $row->active && $charge === (bool) $row->is_charge) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('fin_currencies')->where('code', $code)->update(['active' => $active, 'is_charge' => $charge, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->syncCharge($actor);
            $before = ($row->active ? 'activa' : 'inactiva').($row->is_charge ? ' · de cobro' : '');
            $after = ($active ? 'activa' : 'inactiva').($charge ? ' · de cobro' : '');
            $this->audit->log('Moneda', $code, 'editar', $before, $after);

            return ['code' => $code, 'active' => $active, 'is_charge' => $charge];
        });
    }

    public function saveSettings(array $data, User $actor): array
    {
        $current = $this->settings();

        if ((float) $data['margin_pct'] !== $current['margin_pct']) {
            $this->rules->params('R-MULTICURRENCY', ['fxMarginPct' => (float) $data['margin_pct']], $actor);
        }

        $values = $this->settings->section('ecommerce');
        $this->settings->save('ecommerce', [...$values, 'fxMarginPct' => (float) $data['margin_pct'], 'fxAlertPct' => (float) $data['alert_pct']], $actor);
        RuleResolver::invalidate($this->context->idOrFail());
        $this->audit->log('Moneda', 'configuracion', 'editar', "margen {$current['margin_pct']} % · alerta {$current['alert_pct']} %", "margen {$data['margin_pct']} % · alerta {$data['alert_pct']} %");

        return $this->settings();
    }

    private function syncCharge(User $actor): void
    {
        $charge = DB::table('fin_currencies')->where('is_charge', true)->orderByDesc('is_base')->orderBy('code')->pluck('code')->all();
        $values = $this->settings->section('ecommerce');
        $this->settings->save('ecommerce', [...$values, 'chargeCurrencies' => $charge], $actor);
    }

    private function ensure(): void
    {
        $existing = DB::table('fin_currencies')->pluck('code')->map(fn ($code): string => trim((string) $code))->all();
        $missing = array_diff(array_keys(self::DEFAULTS), $existing);

        if ($missing === []) {
            return;
        }

        $charge = (array) ($this->settings->section('ecommerce')['chargeCurrencies'] ?? ['PEN', 'USD']);

        foreach ($missing as $code) {
            $default = self::DEFAULTS[$code];
            $isCharge = $code === self::BASE || ($default['active'] && in_array($code, $charge, true));
            DB::table('fin_currencies')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'name' => $default['name'],
                'symbol' => $default['symbol'],
                'active' => $code === self::BASE || $default['active'],
                'is_base' => $code === self::BASE,
                'is_charge' => $isCharge,
            ]);
        }
    }
}
