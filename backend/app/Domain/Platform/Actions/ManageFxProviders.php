<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Integrations\Support\FxAdapters;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\FxProviderCatalog;
use App\Domain\Platform\Support\IntegrationSecrets;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Validation\ValidationException;
use Throwable;

final class ManageFxProviders
{
    public const ENTITY = 'Integración';

    public function __construct(
        private readonly FxProviderCatalog $catalog,
        private readonly FxAdapters $adapters,
        private readonly PlatformSession $session,
    ) {}

    public function overview(): array
    {
        $providers = array_map(fn (array $row): array => $this->catalog->present($row), $this->catalog->all());

        return [
            'providers' => $providers,
            'drivers' => $this->catalog->drivers(),
            'simulated' => $this->adapters->simulated(),
            'counts' => [
                'total' => count($providers),
                'validated' => count(array_filter($providers, fn (array $row): bool => $row['status'] === 'validado')),
            ],
        ];
    }

    public function create(array $data, PlatformUser $actor): array
    {
        return $this->catalog->locked(function () use ($data, $actor): array {
            $providers = $this->catalog->all();
            $code = strtoupper(trim((string) $data['code']));

            if (collect($providers)->contains(fn (array $row): bool => $row['code'] === $code)) {
                throw ValidationException::withMessages(['code' => 'Ya existe un proveedor con ese código.']);
            }

            $fields = FxProviderCatalog::DRIVERS[$data['driver']]['fields'];
            $provider = [
                'code' => $code,
                'name' => trim((string) $data['name']),
                'driver' => (string) $data['driver'],
                'status' => 'por_validar',
                'note' => $this->note($data['note'] ?? null),
                'credentials' => IntegrationSecrets::seal(IntegrationSecrets::merge([], (array) ($data['credentials'] ?? []), $fields)),
                'updated_at' => now()->utc()->toIso8601String(),
            ];
            $this->catalog->save([...$providers, $provider], (string) $actor->getKey());
            $this->session->log(self::ENTITY, $this->label($code), 'crear', null, "{$provider['name']} · ".FxProviderCatalog::DRIVERS[$provider['driver']]['label'].' · por validar', $actor);

            return $this->catalog->present($this->catalog->find($code) ?? $provider);
        });
    }

    public function update(string $code, array $data, PlatformUser $actor): array
    {
        return $this->catalog->locked(function () use ($code, $data, $actor): array {
            $providers = $this->catalog->all();
            $index = $this->index($providers, $code);
            $current = $providers[$index];
            $fields = $this->catalog->fields($current);
            $credentials = $this->catalog->credentials($current);
            $merged = IntegrationSecrets::merge($credentials, (array) ($data['credentials'] ?? []), $fields);
            $next = [
                ...$current,
                'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $current['name'],
                'note' => array_key_exists('note', $data) ? $this->note($data['note']) : $current['note'],
            ];
            $keysChanged = $merged !== $credentials;
            $changes = array_filter([
                'nombre' => $next['name'] !== $current['name'] ? [$current['name'], $next['name']] : null,
                'nota' => $next['note'] !== $current['note'] ? [$current['note'] ?? '—', $next['note'] ?? '—'] : null,
                'credenciales' => $keysChanged ? [$credentials === [] ? 'sin cargar' : 'cargadas', 'cambiadas'] : null,
            ]);

            if ($changes === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            if ($keysChanged) {
                $next = [...$next, 'credentials' => IntegrationSecrets::seal($merged), 'status' => $current['driver'] === 'simulado' ? $current['status'] : 'por_validar', 'last_test_ok' => null, 'last_test_result' => null, 'last_test_at' => null];
            }

            $providers[$index] = [...$next, 'updated_at' => now()->utc()->toIso8601String()];
            $this->catalog->save($providers, (string) $actor->getKey());

            foreach ($changes as $field => [$before, $after]) {
                $this->session->log(self::ENTITY, $this->label($current['code']), 'editar', "{$field}: {$before}", "{$field}: {$after}", $actor);
            }

            return $this->catalog->present($providers[$index]);
        });
    }

    public function delete(string $code, PlatformUser $actor): void
    {
        $this->catalog->locked(function () use ($code, $actor): void {
            $providers = $this->catalog->all();
            $index = $this->index($providers, $code);
            $removed = $providers[$index];
            unset($providers[$index]);
            $this->catalog->save($providers, (string) $actor->getKey());
            $this->session->log(self::ENTITY, $this->label($removed['code']), 'eliminar', "{$removed['name']} · ".(FxProviderCatalog::STATUS[$removed['status']] ?? $removed['status']), null, $actor);
        });
    }

    public function test(string $code, PlatformUser $actor): array
    {
        return $this->catalog->locked(function () use ($code, $actor): array {
            $providers = $this->catalog->all();
            $index = $this->index($providers, $code);
            $provider = $providers[$index];

            try {
                $check = $this->adapters->for($provider)->healthcheck();
                $simulated = (bool) ($check->payload['simulated'] ?? false);
                [$ok, $result] = [$check->ok, $check->ok ? ($simulated ? 'Respuesta correcta del proveedor simulado.' : 'Conexión correcta.') : ($check->message ?? 'El proveedor rechazó la prueba.')];
            } catch (Throwable $e) {
                [$ok, $result] = [false, mb_substr($e->getMessage(), 0, 240)];
            }

            $status = $ok ? 'validado' : 'por_validar';
            $providers[$index] = [...$provider, 'status' => $status, 'last_test_at' => now()->utc()->toIso8601String(), 'last_test_ok' => $ok, 'last_test_result' => $result, 'updated_at' => now()->utc()->toIso8601String()];
            $this->catalog->save($providers, (string) $actor->getKey());
            $this->session->log(self::ENTITY, $this->label($provider['code']), 'probar_conexion', FxProviderCatalog::STATUS[$provider['status']], FxProviderCatalog::STATUS[$status].' · '.mb_substr($result, 0, 160), $actor);

            return ['code' => $provider['code'], 'ok' => $ok, 'result' => $result, 'status' => $status, 'tested_at' => $providers[$index]['last_test_at']];
        });
    }

    private function index(array $providers, string $code): int
    {
        $code = strtoupper(trim($code));

        foreach ($providers as $index => $row) {
            if ($row['code'] === $code) {
                return $index;
            }
        }

        throw ApiException::notFound('El proveedor de tipo de cambio no existe.');
    }

    private function note(mixed $note): ?string
    {
        $note = trim((string) $note);

        return $note === '' ? null : mb_substr($note, 0, 300);
    }

    private function label(string $code): string
    {
        return "Tipo de cambio · {$code}";
    }
}
