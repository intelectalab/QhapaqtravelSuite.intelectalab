<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;

final class ReportTabs
{
    public const TITLES = [
        'comercial' => 'Comercial',
        'cotizaciones' => 'Cotizaciones',
        'reservas' => 'Reservas',
        'operaciones' => 'Operaciones',
        'finanzas' => 'Finanzas',
        'proveedores' => 'Proveedores',
        'clientes' => 'Clientes',
    ];

    private const BY_ROLE = [
        'tenant_admin' => ['comercial', 'cotizaciones', 'reservas', 'operaciones', 'finanzas', 'proveedores', 'clientes'],
        'manager' => ['comercial', 'cotizaciones', 'reservas', 'operaciones', 'finanzas', 'proveedores', 'clientes'],
        'sales' => ['comercial', 'cotizaciones'],
        'operations' => ['reservas', 'operaciones', 'proveedores'],
        'finance' => ['finanzas'],
        'accounting' => ['finanzas'],
    ];

    private const BY_PERMISSION = [
        'comercial' => ['crm.leads.view'],
        'cotizaciones' => ['quotes.view'],
        'reservas' => ['reservations.view'],
        'operaciones' => ['operations.view'],
        'finanzas' => ['finance.receivables', 'finance.profitability'],
        'proveedores' => ['catalog.providers.manage', 'finance.payables'],
        'clientes' => ['crm.clients.manage'],
    ];

    public static function for(User $user): array
    {
        $role = $user->primaryRole()?->name;
        $keys = self::BY_ROLE[$role] ?? array_keys(array_filter(self::BY_PERMISSION, fn (array $permissions): bool => collect($permissions)->contains(fn (string $permission): bool => $user->can($permission))));

        return array_map(fn (string $key): array => ['key' => $key, 'title' => self::TITLES[$key]], $keys);
    }

    public static function assert(User $user, string $report): void
    {
        if (! isset(self::TITLES[$report])) {
            throw ApiException::notFound('El reporte no existe.');
        }

        if (! in_array($report, array_column(self::for($user), 'key'), true)) {
            throw ApiException::forbidden('REP-BR-01', 'El reporte solicitado no está disponible para su rol.', self::BY_PERMISSION[$report]);
        }
    }
}
