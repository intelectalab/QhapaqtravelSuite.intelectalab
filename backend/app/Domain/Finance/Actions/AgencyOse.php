<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Support\OseCatalog;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;

final class AgencyOse
{
    public function __construct(
        private readonly OseCatalog $catalog,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function overview(User $viewer): array
    {
        $status = $this->catalog->status($this->catalog->tenant($this->context->idOrFail()));

        return [
            ...$status,
            'credentials' => array_map(fn (array $field): array => [...$field, 'hint' => null], $status['credentials']),
            'options' => array_values(array_map(fn (array $row): array => $this->catalog->present($row), array_filter($this->catalog->all(), fn (array $row): bool => $row['status'] === 'homologado'))),
            'can_choose' => $viewer->can('admin.settings.manage'),
        ];
    }

    public function select(?string $code, User $actor): array
    {
        $tenantId = $this->context->idOrFail();

        $this->catalog->locked($this->catalog->tenantKey($tenantId), function () use ($tenantId, $code): void {
            $record = $this->catalog->tenant($tenantId);
            $provider = $code === null ? null : ($this->catalog->find($code) ?? throw ApiException::notFound('El OSE no existe en el catálogo.'));

            if ($provider !== null && $provider['status'] !== 'homologado') {
                throw ApiException::unprocessable('OSE-NOT-HOMOLOGATED', 'Ese OSE todavía no está homologado por KipuControl. Elige uno homologado.');
            }

            if (($provider['code'] ?? null) === $record['code']) {
                throw ApiException::unprocessable('CFG-BR-01', $provider === null ? 'La agencia aún no tiene un OSE elegido.' : 'Ese OSE ya está elegido.');
            }

            $this->catalog->saveTenant($tenantId, [
                'code' => $provider['code'] ?? null,
                'chosen_at' => $provider === null ? null : now()->utc()->toIso8601String(),
                'credentials' => '',
                'credentials_at' => null,
                'last_test_at' => null,
                'last_test_ok' => null,
                'last_test_result' => null,
            ], null);
            $this->audit->log('OSE', $provider['code'] ?? (string) $record['code'], 'elegir_ose', $record['code'] ?? 'sin OSE', $provider === null ? 'sin OSE (modo simulado)' : "{$provider['code']} · {$provider['name']}");
        });

        return $this->overview($actor);
    }
}
