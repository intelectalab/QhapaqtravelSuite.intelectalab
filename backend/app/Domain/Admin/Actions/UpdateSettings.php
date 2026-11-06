<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Admin\Support\SettingsDirectory;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class UpdateSettings
{
    private const AGENCY_FIELDS = ['legal_name', 'commercial_name', 'logo_initials', 'timezone', 'fiscal_address', 'legal_rep'];

    private const INTEGERS = ['tax_pct', 'quote_validity_days', 'hold_minutes', 'markup_pct', 'max_discount_pct', 'advance_pct', 'balance_days_before'];

    public function __construct(
        private readonly TenantSettings $settings,
        private readonly SettingsDirectory $directory,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function section(string $section, array $data, User $actor): array
    {
        return DB::transaction(function () use ($section, $data, $actor): array {
            if ($section === 'agency') {
                return $this->agency($data);
            }

            $before = $this->settings->section($section);
            $after = [...$before, ...$this->normalize($section, $data, $before)];
            $changed = TenantSettings::changes($before, $after);

            if ($changed === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->save($section, $after, $actor);

            foreach ($changed as $key => [$old, $new]) {
                $this->audit->log('Configuración', "{$section}.{$key}", 'actualizar', TenantSettings::text($old), TenantSettings::text($new));
            }

            $warnings = [];

            if ($section === 'channels' && isset($changed['ecommerce']) && $after['ecommerce'] && DB::table('integration_adapters')->where('kind', 'payments')->whereIn('status', ['por_validar', 'futuro'])->exists()) {
                $warnings[] = 'La pasarela de pagos aún está por validar: los pagos en línea quedarán como pendientes.';
            }

            return ['changed' => array_keys($changed), 'warnings' => $warnings];
        });
    }

    public function sequence(string $docType, array $data): void
    {
        DB::transaction(function () use ($docType, $data): void {
            $row = DB::table('sys_sequences')->where('doc_type', $docType)->where('series', 'default')->lockForUpdate()->first(['id', 'label', 'prefix', 'next_number']);

            if ($row === null) {
                throw ApiException::notFound('La serie no existe.');
            }

            $prefix = trim((string) $data['prefix']);
            $next = (int) $data['next_number'];

            if ($next < (int) $row->next_number) {
                throw ApiException::unprocessable('CFG-BR-07', "El correlativo solo puede avanzar. El próximo número actual es {$row->next_number}.");
            }

            if (DB::table('sys_sequences')->where('prefix', $prefix)->where('id', '<>', $row->id)->exists()) {
                throw ApiException::conflict('CFG-BR-07', 'Ese prefijo ya lo usa otra serie.');
            }

            if ($prefix === $row->prefix && $next === (int) $row->next_number) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('sys_sequences')->where('id', $row->id)->update(['prefix' => $prefix, 'next_number' => $next, 'updated_at' => now()]);
            $this->audit->log('Configuración', "series.{$row->label}", 'actualizar', "{$row->prefix} · {$row->next_number}", "{$prefix} · {$next}");
        });
    }

    private function agency(array $data): array
    {
        $tenant = $this->context->tenant();
        $after = collect(self::AGENCY_FIELDS)->filter(fn (string $field): bool => array_key_exists($field, $data))->mapWithKeys(fn (string $field): array => [$field => $field === 'logo_initials' ? mb_strtoupper(trim((string) $data[$field])) : $data[$field]])->all();
        $before = collect(self::AGENCY_FIELDS)->mapWithKeys(fn (string $field): array => [$field => $tenant->getAttribute($field)])->all();
        $changed = TenantSettings::changes($before, $after);

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        DB::table('tenants')->where('id', $tenant->getKey())->update([...array_map(fn (array $pair): mixed => $pair[1], $changed), 'updated_at' => now()]);
        $tenant->refresh();

        foreach ($changed as $key => [$old, $new]) {
            $this->audit->log('Configuración', "agencia.{$key}", 'actualizar', TenantSettings::text($old), TenantSettings::text($new));
        }

        return ['changed' => array_keys($changed), 'warnings' => []];
    }

    private function normalize(string $section, array $data, array $before): array
    {
        $baseChanged = $section === 'currency' && isset($data['base_currency']) && $data['base_currency'] !== ($before['base_currency'] ?? 'PEN');

        if ($baseChanged && (DB::table('booking_reservations')->exists() || DB::table('fin_payments')->exists())) {
            throw ApiException::unprocessable('CFG-BR-05', 'La moneda base no se puede cambiar porque ya hay reservas o pagos registrados.');
        }

        if ($section === 'channels') {
            $rank = $this->directory->planRank();

            return collect(SettingsCatalog::CHANNELS)->mapWithKeys(fn (array $channel, string $key): array => [$key => $rank >= $channel['plan'] && (bool) ($data[$key] ?? false)])->all();
        }

        return collect($data)->map(function (mixed $value, string $key): mixed {
            return match (true) {
                in_array($key, self::INTEGERS, true), str_ends_with($key, '_min'), str_ends_with($key, '_hours'), str_ends_with($key, '_days'), str_ends_with($key, '_before'), $key === 'max_pax_per_guide' => (int) $value,
                $key === 'price_with_tax' => (bool) $value,
                default => $value,
            };
        })->all();
    }
}
