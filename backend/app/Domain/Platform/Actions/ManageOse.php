<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use App\Domain\Platform\Support\IntegrationSecrets;
use App\Domain\Platform\Support\OseCatalog;
use App\Domain\Platform\Support\TenantDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Validation\ValidationException;
use Throwable;

final class ManageOse
{
    public function __construct(
        private readonly OseCatalog $catalog,
        private readonly TenantDirectory $tenants,
        private readonly PlatformSession $session,
        private readonly FiscalWebhookSecret $webhooks,
    ) {}

    public function overview(): array
    {
        $usage = $this->catalog->usage();
        $providers = array_map(fn (array $row): array => [...$this->catalog->present($row, $usage[$row['code']] ?? 0), 'webhook' => $this->webhooks->summary($row['code'])], $this->catalog->all());

        return [
            'providers' => $providers,
            'drivers' => $this->catalog->drivers(),
            'simulated' => (string) config('integrations.drivers.fiscal', 'fake') === 'fake',
            'counts' => [
                'total' => count($providers),
                'homologated' => count(array_filter($providers, fn (array $row): bool => $row['status'] === 'homologado')),
                'tenants' => array_sum($usage),
            ],
        ];
    }

    public function create(array $data, PlatformUser $actor): array
    {
        return $this->catalog->locked(OseCatalog::KEY, function () use ($data, $actor): array {
            $providers = $this->catalog->all();
            $code = strtoupper(trim((string) $data['code']));

            if (collect($providers)->contains(fn (array $row): bool => $row['code'] === $code)) {
                throw ValidationException::withMessages(['code' => 'Ya existe un OSE con ese código.']);
            }

            $status = ($data['status'] ?? 'por_homologar') === 'homologado' ? 'homologado' : 'por_homologar';
            $provider = [
                'code' => $code,
                'name' => trim((string) $data['name']),
                'driver' => (string) $data['driver'],
                'status' => $status,
                'note' => $this->note($data['note'] ?? null),
                'homologated_at' => $status === 'homologado' ? now()->utc()->toIso8601String() : null,
                'updated_at' => now()->utc()->toIso8601String(),
            ];
            $this->catalog->save([...$providers, $provider], (string) $actor->getKey());
            $this->session->log(ManageFxProviders::ENTITY, $this->label($code), 'crear', null, "{$provider['name']} · ".OseCatalog::STATUS[$status], $actor);

            return $this->catalog->present($this->catalog->find($code) ?? $provider, 0);
        });
    }

    public function update(string $code, array $data, PlatformUser $actor): array
    {
        return $this->catalog->locked(OseCatalog::KEY, function () use ($code, $data, $actor): array {
            $providers = $this->catalog->all();
            $index = $this->index($providers, $code);
            $current = $providers[$index];
            $status = array_key_exists('status', $data) ? ($data['status'] === 'homologado' ? 'homologado' : 'por_homologar') : $current['status'];
            $next = [
                ...$current,
                'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $current['name'],
                'note' => array_key_exists('note', $data) ? $this->note($data['note']) : $current['note'],
                'status' => $status,
                'homologated_at' => $status === 'homologado' ? ($current['homologated_at'] ?? now()->utc()->toIso8601String()) : null,
            ];
            $changes = array_filter([
                'nombre' => $next['name'] !== $current['name'] ? [$current['name'], $next['name']] : null,
                'nota' => $next['note'] !== $current['note'] ? [$current['note'] ?? '—', $next['note'] ?? '—'] : null,
                'estado' => $status !== $current['status'] ? [OseCatalog::STATUS[$current['status']], OseCatalog::STATUS[$status]] : null,
            ]);

            if ($changes === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $providers[$index] = [...$next, 'updated_at' => now()->utc()->toIso8601String()];
            $this->catalog->save($providers, (string) $actor->getKey());

            foreach ($changes as $field => [$before, $after]) {
                $this->session->log(ManageFxProviders::ENTITY, $this->label($current['code']), $field === 'estado' ? ($status === 'homologado' ? 'homologar' : 'quitar_homologacion') : 'editar', "{$field}: {$before}", "{$field}: {$after}", $actor);
            }

            return $this->catalog->present($providers[$index], $this->catalog->usage()[$current['code']] ?? 0);
        });
    }

    public function delete(string $code, PlatformUser $actor): void
    {
        $this->catalog->locked(OseCatalog::KEY, function () use ($code, $actor): void {
            $providers = $this->catalog->all();
            $index = $this->index($providers, $code);
            $removed = $providers[$index];
            $inUse = $this->catalog->usage()[$removed['code']] ?? 0;

            if ($inUse > 0) {
                throw ApiException::conflict('OSE-IN-USE', $inUse === 1 ? 'Una agencia usa este OSE: pídele que elija otro antes de eliminarlo.' : "{$inUse} agencias usan este OSE: pídeles que elijan otro antes de eliminarlo.");
            }

            unset($providers[$index]);
            $this->catalog->save($providers, (string) $actor->getKey());
            $this->webhooks->forget($removed['code'], (string) $actor->getKey());
            $this->session->log(ManageFxProviders::ENTITY, $this->label($removed['code']), 'eliminar', "{$removed['name']} · ".OseCatalog::STATUS[$removed['status']], null, $actor);
        });
    }

    public function generateWebhookSecret(string $code, PlatformUser $actor): array
    {
        return $this->catalog->locked(FiscalWebhookSecret::KEY, function () use ($code, $actor): array {
            $providers = $this->catalog->all();
            $provider = $providers[$this->index($providers, $code)];
            $secret = 'kipu_ose_'.bin2hex(random_bytes(24));
            $rotated = $this->webhooks->store($provider['code'], $secret, (string) $actor->getKey());
            $this->session->log(ManageFxProviders::ENTITY, $this->label($provider['code']), $rotated ? 'rotar_clave_webhook' : 'generar_clave_webhook', $rotated ? 'configurada' : null, $rotated ? 'rotada · la anterior vale '.FiscalWebhookSecret::ROTATION_HOURS.' h' : 'generada', $actor);

            return [...$this->webhooks->summary($provider['code']), 'code' => $provider['code'], 'secret' => $secret, 'rotated' => $rotated];
        });
    }

    public function tenant(string $id): array
    {
        $tenant = $this->locate($id);

        return [
            ...$this->catalog->status($this->catalog->tenant((string) $tenant->getKey())),
            'tenant' => ['code' => $tenant->code, 'name' => $tenant->commercial_name, 'ruc' => $tenant->ruc],
            'catalog' => array_map(fn (array $row): array => $this->catalog->present($row), $this->catalog->all()),
        ];
    }

    public function saveCredentials(string $id, array $credentials, PlatformUser $actor): array
    {
        $tenant = $this->locate($id);
        $key = $this->catalog->tenantKey((string) $tenant->getKey());

        $this->catalog->locked($key, function () use ($tenant, $credentials, $actor): void {
            $record = $this->catalog->tenant((string) $tenant->getKey());
            $provider = $this->catalog->find($record['code']) ?? throw ApiException::conflict('OSE-NOT-CHOSEN', 'La agencia aún no elige su OSE: las credenciales dependen del OSE elegido.');
            $fields = $this->catalog->fields($provider);

            if ($fields === []) {
                throw ApiException::unprocessable('CFG-BR-01', "{$provider['name']} no necesita credenciales.");
            }

            $current = IntegrationSecrets::open($record['credentials']);
            $merged = IntegrationSecrets::merge($current, $credentials, $fields);

            if ($merged === $current) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->catalog->saveTenant((string) $tenant->getKey(), [
                ...$record,
                'credentials' => IntegrationSecrets::seal($merged),
                'credentials_at' => now()->utc()->toIso8601String(),
                'last_test_at' => null,
                'last_test_ok' => null,
                'last_test_result' => null,
            ], (string) $actor->getKey());
            $changed = array_keys(array_diff_assoc($merged, $current));
            $this->session->log(ManageFxProviders::ENTITY, $this->label($provider['code'], $tenant), 'cargar_credenciales', $current === [] ? null : 'cargadas', 'cambiadas: '.implode(', ', array_map(fn (string $field): string => $fields[$field], $changed)), $actor);
        });

        return $this->tenant($id);
    }

    public function clearCredentials(string $id, PlatformUser $actor): array
    {
        $tenant = $this->locate($id);
        $key = $this->catalog->tenantKey((string) $tenant->getKey());

        $this->catalog->locked($key, function () use ($tenant, $actor): void {
            $record = $this->catalog->tenant((string) $tenant->getKey());

            if ($record['credentials'] === '') {
                throw ApiException::unprocessable('CFG-BR-01', 'La agencia no tiene credenciales cargadas.');
            }

            $this->catalog->saveTenant((string) $tenant->getKey(), [...$record, 'credentials' => '', 'credentials_at' => null, 'last_test_at' => null, 'last_test_ok' => null, 'last_test_result' => null], (string) $actor->getKey());
            $this->session->log(ManageFxProviders::ENTITY, $this->label((string) $record['code'], $tenant), 'quitar_credenciales', 'cargadas', null, $actor);
        });

        return $this->tenant($id);
    }

    public function test(string $id, PlatformUser $actor): array
    {
        $tenant = $this->locate($id);
        $key = $this->catalog->tenantKey((string) $tenant->getKey());

        return $this->catalog->locked($key, function () use ($tenant, $actor): array {
            $record = $this->catalog->tenant((string) $tenant->getKey());
            $provider = $this->catalog->find($record['code']) ?? throw ApiException::conflict('OSE-NOT-CHOSEN', 'La agencia aún no elige su OSE.');
            $fields = $this->catalog->fields($provider);
            $missing = IntegrationSecrets::missing($fields, IntegrationSecrets::open($record['credentials']));

            if ($missing !== []) {
                [$ok, $result] = [false, 'Faltan credenciales: '.implode(', ', array_map(fn (string $field): string => $fields[$field], $missing)).'.'];
            } else {
                try {
                    $check = app(FiscalGateway::class)->healthcheck();
                    $simulated = (bool) ($check->payload['simulated'] ?? false);
                    [$ok, $result] = [$check->ok, $check->ok ? ($simulated ? 'Respuesta correcta del OSE simulado.' : 'Conexión correcta con el OSE.') : ($check->message ?? 'El OSE rechazó la prueba.')];
                } catch (Throwable $e) {
                    [$ok, $result] = [false, mb_substr($e->getMessage(), 0, 240)];
                }
            }

            $at = now()->utc()->toIso8601String();
            $this->catalog->saveTenant((string) $tenant->getKey(), [...$record, 'last_test_at' => $at, 'last_test_ok' => $ok, 'last_test_result' => $result], (string) $actor->getKey());
            $this->session->log(ManageFxProviders::ENTITY, $this->label($provider['code'], $tenant), 'probar_conexion', null, ($ok ? 'correcta · ' : 'fallida · ').mb_substr($result, 0, 160), $actor);

            return ['ok' => $ok, 'result' => $result, 'tested_at' => $at];
        });
    }

    private function locate(string $id): Tenant
    {
        return $this->tenants->locate($id) ?? throw ApiException::notFound('La agencia no existe.');
    }

    private function index(array $providers, string $code): int
    {
        $code = strtoupper(trim($code));

        foreach ($providers as $index => $row) {
            if ($row['code'] === $code) {
                return $index;
            }
        }

        throw ApiException::notFound('El OSE no existe en el catálogo.');
    }

    private function note(mixed $note): ?string
    {
        $note = trim((string) $note);

        return $note === '' ? null : mb_substr($note, 0, 300);
    }

    private function label(string $code, ?Tenant $tenant = null): string
    {
        return $tenant === null ? "OSE · {$code}" : "OSE · {$code} · {$tenant->code}";
    }
}
