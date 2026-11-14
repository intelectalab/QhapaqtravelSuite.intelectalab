<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\DB;

final class FxProviderCatalog
{
    public const KEY = 'fx_providers';

    public const DRIVERS = [
        'simulado' => ['label' => 'Simulado de KipuControl', 'kind' => 'Simulado', 'fields' => []],
        'bcrp' => ['label' => 'BCRP · API de series estadísticas', 'kind' => 'Oficial', 'fields' => []],
        'sunat' => ['label' => 'SUNAT · tipo de cambio publicado', 'kind' => 'Oficial', 'fields' => ['token' => 'Token de acceso']],
        'api' => ['label' => 'API comercial de divisas', 'kind' => 'API', 'fields' => ['api_key' => 'Clave de API']],
    ];

    public const STATUS = ['validado' => 'Validado', 'por_validar' => 'Por validar'];

    private const DEFAULTS = [
        ['code' => 'SIMULADO', 'name' => 'Simulado (demostración)', 'driver' => 'simulado', 'status' => 'validado', 'note' => 'Valores de prueba fijos para demostraciones y capacitación.'],
        ['code' => 'BCRP', 'name' => 'Banco Central de Reserva del Perú', 'driver' => 'bcrp', 'status' => 'por_validar', 'note' => 'Tipo de cambio interbancario publicado por el BCRP.'],
        ['code' => 'SUNAT', 'name' => 'SUNAT', 'driver' => 'sunat', 'status' => 'por_validar', 'note' => 'Tipo de cambio publicado por SUNAT para operaciones tributarias.'],
    ];

    private const CONNECTION = 'pgsql_platform';

    public function all(): array
    {
        $stored = PlatformSettings::read(self::KEY);

        if (! array_key_exists('providers', $stored)) {
            return array_map(fn (array $row): array => $this->normalize($row), self::DEFAULTS);
        }

        return array_values(array_map(fn (array $row): array => $this->normalize($row), (array) $stored['providers']));
    }

    public function find(string $code): ?array
    {
        $code = strtoupper(trim($code));

        return collect($this->all())->first(fn (array $row): bool => $row['code'] === $code);
    }

    public function validated(): array
    {
        return array_values(array_filter($this->all(), fn (array $row): bool => $row['status'] === 'validado'));
    }

    public function credentials(array $provider): array
    {
        return IntegrationSecrets::open($provider['credentials'] ?? null);
    }

    public function fields(array $provider): array
    {
        return self::DRIVERS[$provider['driver']]['fields'] ?? [];
    }

    public function kind(array $provider): string
    {
        return self::DRIVERS[$provider['driver']]['kind'] ?? 'API';
    }

    public function present(array $provider): array
    {
        $fields = $this->fields($provider);
        $credentials = $this->credentials($provider);

        return [
            'code' => $provider['code'],
            'name' => $provider['name'],
            'driver' => $provider['driver'],
            'driver_label' => self::DRIVERS[$provider['driver']]['label'] ?? $provider['driver'],
            'kind' => $this->kind($provider),
            'status' => $provider['status'],
            'status_label' => self::STATUS[$provider['status']] ?? $provider['status'],
            'note' => $provider['note'],
            'credentials' => IntegrationSecrets::mask($fields, $credentials),
            'credentials_complete' => IntegrationSecrets::missing($fields, $credentials) === [],
            'last_test_at' => $provider['last_test_at'],
            'last_test_ok' => $provider['last_test_ok'],
            'last_test_result' => $provider['last_test_result'],
            'updated_at' => $provider['updated_at'],
        ];
    }

    public function drivers(): array
    {
        return collect(self::DRIVERS)->map(fn (array $driver, string $code): array => [
            'value' => $code,
            'label' => $driver['label'],
            'kind' => $driver['kind'],
            'fields' => collect($driver['fields'])->map(fn (string $label, string $field): array => ['field' => $field, 'label' => $label])->values()->all(),
        ])->values()->all();
    }

    public function save(array $providers, ?string $actorId): void
    {
        PlatformSettings::write(self::KEY, ['providers' => array_values($providers)], $actorId);
    }

    public function locked(callable $callback): mixed
    {
        return DB::connection(self::CONNECTION)->transaction(function () use ($callback): mixed {
            DB::connection(self::CONNECTION)->select('select pg_advisory_xact_lock(hashtext(?))', ['platform_settings:'.self::KEY]);

            return $callback();
        });
    }

    private function normalize(array $row): array
    {
        return [
            'code' => strtoupper((string) ($row['code'] ?? '')),
            'name' => (string) ($row['name'] ?? ''),
            'driver' => (string) ($row['driver'] ?? 'simulado'),
            'status' => ($row['status'] ?? '') === 'validado' ? 'validado' : 'por_validar',
            'note' => isset($row['note']) && $row['note'] !== '' ? (string) $row['note'] : null,
            'credentials' => (string) ($row['credentials'] ?? ''),
            'last_test_at' => $row['last_test_at'] ?? null,
            'last_test_ok' => isset($row['last_test_ok']) ? (bool) $row['last_test_ok'] : null,
            'last_test_result' => $row['last_test_result'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
