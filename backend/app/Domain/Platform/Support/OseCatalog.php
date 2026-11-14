<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\DB;

final class OseCatalog
{
    public const KEY = 'ose_providers';

    public const TENANT_PREFIX = 'ose:';

    public const DRIVERS = [
        'sandbox' => ['label' => 'Sandbox de KipuControl (simulado)', 'fields' => []],
        'rest' => ['label' => 'OSE con API REST', 'fields' => ['usuario' => 'Usuario', 'clave' => 'Clave', 'token' => 'Token de API']],
        'sol' => ['label' => 'OSE con usuario SOL secundario', 'fields' => ['usuario_sol' => 'Usuario SOL secundario', 'clave_sol' => 'Clave SOL', 'certificado_clave' => 'Clave del certificado digital']],
    ];

    public const STATUS = ['homologado' => 'Homologado', 'por_homologar' => 'Por homologar'];

    private const CONNECTION = 'pgsql_platform';

    public function all(): array
    {
        return array_values(array_map(fn (array $row): array => $this->normalize($row), (array) (PlatformSettings::read(self::KEY)['providers'] ?? [])));
    }

    public function find(?string $code): ?array
    {
        if ($code === null || $code === '') {
            return null;
        }

        $code = strtoupper(trim($code));

        return collect($this->all())->first(fn (array $row): bool => $row['code'] === $code);
    }

    public function fields(?array $provider): array
    {
        return $provider === null ? [] : (self::DRIVERS[$provider['driver']]['fields'] ?? []);
    }

    public function present(array $provider, ?int $tenants = null): array
    {
        return [
            'code' => $provider['code'],
            'name' => $provider['name'],
            'driver' => $provider['driver'],
            'driver_label' => self::DRIVERS[$provider['driver']]['label'] ?? $provider['driver'],
            'status' => $provider['status'],
            'status_label' => self::STATUS[$provider['status']] ?? $provider['status'],
            'note' => $provider['note'],
            'homologated_at' => $provider['homologated_at'],
            'fields' => collect($this->fields($provider))->map(fn (string $label, string $field): array => ['field' => $field, 'label' => $label])->values()->all(),
            'tenants' => $tenants,
            'updated_at' => $provider['updated_at'],
        ];
    }

    public function drivers(): array
    {
        return collect(self::DRIVERS)->map(fn (array $driver, string $code): array => [
            'value' => $code,
            'label' => $driver['label'],
            'fields' => collect($driver['fields'])->map(fn (string $label, string $field): array => ['field' => $field, 'label' => $label])->values()->all(),
        ])->values()->all();
    }

    public function save(array $providers, ?string $actorId): void
    {
        PlatformSettings::write(self::KEY, ['providers' => array_values($providers)], $actorId);
    }

    public function locked(string $key, callable $callback): mixed
    {
        return DB::connection(self::CONNECTION)->transaction(function () use ($key, $callback): mixed {
            DB::connection(self::CONNECTION)->select('select pg_advisory_xact_lock(hashtext(?))', ["platform_settings:{$key}"]);

            return $callback();
        });
    }

    public function tenantKey(string $tenantId): string
    {
        return self::TENANT_PREFIX.$tenantId;
    }

    public function tenant(string $tenantId): array
    {
        $raw = PlatformSettings::read($this->tenantKey($tenantId));

        return [
            'code' => isset($raw['code']) && $raw['code'] !== '' ? (string) $raw['code'] : null,
            'chosen_at' => $raw['chosen_at'] ?? null,
            'credentials' => (string) ($raw['credentials'] ?? ''),
            'credentials_at' => $raw['credentials_at'] ?? null,
            'last_test_at' => $raw['last_test_at'] ?? null,
            'last_test_ok' => isset($raw['last_test_ok']) ? (bool) $raw['last_test_ok'] : null,
            'last_test_result' => $raw['last_test_result'] ?? null,
        ];
    }

    public function saveTenant(string $tenantId, array $record, ?string $actorId): void
    {
        PlatformSettings::write($this->tenantKey($tenantId), $record, $actorId);
    }

    public function usage(): array
    {
        return DB::connection(self::CONNECTION)->table('platform_settings')->where('key', 'like', self::TENANT_PREFIX.'%')
            ->selectRaw("value->>'code' as code, count(*) as total")->whereRaw("coalesce(value->>'code', '') <> ''")->groupByRaw("value->>'code'")
            ->pluck('total', 'code')->map(fn (mixed $total): int => (int) $total)->all();
    }

    public function status(array $record): array
    {
        $provider = $this->find($record['code']);
        $fields = $this->fields($provider);
        $credentials = IntegrationSecrets::open($record['credentials']);
        $missing = IntegrationSecrets::missing($fields, $credentials);
        $simulatedAdapter = (string) config('integrations.drivers.fiscal', 'fake') === 'fake';

        $reason = match (true) {
            $record['code'] === null => ['sin_ose', 'La agencia aún no elige un OSE homologado: los comprobantes se emiten en modo simulado y no tienen validez ante SUNAT.'],
            $provider === null => ['fuera_de_catalogo', 'El OSE elegido ya no está en el catálogo de KipuControl: elige otro para emitir comprobantes válidos.'],
            $provider['status'] !== 'homologado' => ['por_homologar', "{$provider['name']} todavía no está homologado por KipuControl: mientras tanto se emite en modo simulado."],
            $provider['driver'] === 'sandbox' => ['sandbox', "{$provider['name']} es un entorno de pruebas: los comprobantes no tienen validez ante SUNAT."],
            $missing !== [] => ['sin_credenciales', "Falta que KipuControl cargue las credenciales de {$provider['name']} para la agencia."],
            $record['last_test_ok'] !== true => ['sin_probar', "Falta que KipuControl pruebe la conexión con {$provider['name']}."],
            $simulatedAdapter => ['adaptador_pendiente', "Todo listo con {$provider['name']}; la emisión real se activa cuando KipuControl publique su adaptador."],
            default => ['conectado', "Conectado con {$provider['name']}."],
        };

        return [
            'mode' => $reason[0] === 'conectado' ? 'conectado' : 'simulado',
            'step' => $reason[0],
            'message' => $reason[1],
            'ready' => in_array($reason[0], ['conectado', 'adaptador_pendiente'], true),
            'provider' => $provider === null ? null : $this->present($provider),
            'credentials' => IntegrationSecrets::mask($fields, $credentials),
            'credentials_complete' => $provider !== null && $missing === [],
            'credentials_at' => $record['credentials_at'],
            'chosen_at' => $record['chosen_at'],
            'last_test_at' => $record['last_test_at'],
            'last_test_ok' => $record['last_test_ok'],
            'last_test_result' => $record['last_test_result'],
        ];
    }

    private function normalize(array $row): array
    {
        return [
            'code' => strtoupper((string) ($row['code'] ?? '')),
            'name' => (string) ($row['name'] ?? ''),
            'driver' => (string) ($row['driver'] ?? 'sandbox'),
            'status' => ($row['status'] ?? '') === 'homologado' ? 'homologado' : 'por_homologar',
            'note' => isset($row['note']) && $row['note'] !== '' ? (string) $row['note'] : null,
            'homologated_at' => $row['homologated_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
