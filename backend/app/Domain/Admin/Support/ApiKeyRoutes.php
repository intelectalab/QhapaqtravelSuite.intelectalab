<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Admin\Http\Middleware\AuthenticateApiKey;
use App\Domain\Admin\Http\Middleware\RequireApiScope;
use Illuminate\Routing\Router;

final class ApiKeyRoutes
{
    public const ROUTES = [
        'crm.leads.index' => 'crm:read',
        'crm.leads.store' => 'crm:write',
        'crm.leads.show' => 'crm:read',
        'crm.leads.update' => 'crm:write',
        'crm.opportunities.index' => 'crm:read',
        'crm.opportunities.show' => 'crm:read',
        'crm.clients.index' => 'crm:read',
        'crm.clients.store' => 'crm:write',
        'crm.clients.show' => 'crm:read',
        'crm.clients.update' => 'crm:write',
        'catalog.products.index' => 'catalog:read',
        'catalog.products.show' => 'catalog:read',
        'contract.catalog.products.availability.show' => 'availability:read',
        'catalog.departures.index' => 'availability:read',
        'quotes.index' => 'quotes:read',
        'quotes.store' => 'quotes:write',
        'quotes.show' => 'quotes:read',
        'quotes.versions.store' => 'quotes:write',
        'reservations.index' => 'reservations:read',
        'reservations.store' => 'reservations:write',
        'reservations.show' => 'reservations:read',
        'finance.payments.index' => 'payments:read',
        'finance.payments.show' => 'payments:read',
        'finance.receivables.index' => 'payments:read',
        'finance.receivables.show' => 'payments:read',
        'finance.invoices.index' => 'invoices:read',
        'finance.invoices.show' => 'invoices:read',
        'ops.orders.index' => 'operations:read',
        'ops.orders.show' => 'operations:read',
        'ops.vouchers.index' => 'operations:read',
        'ops.contract.vouchers.show' => 'operations:read',
        'admin.api.webhooks.index' => 'webhooks:manage',
        'admin.api.webhooks.store' => 'webhooks:manage',
        'admin.api.webhooks.update' => 'webhooks:manage',
        'admin.api.webhooks.destroy' => 'webhooks:manage',
    ];

    public const PERMISSIONS = [
        'catalog:read' => ['catalog.products.view'],
        'availability:read' => ['catalog.products.view'],
        'crm:read' => ['crm.leads.view', 'crm.opportunities.manage', 'crm.clients.manage'],
        'crm:write' => ['crm.leads.view', 'crm.leads.manage', 'crm.clients.manage', 'crm.records.reassign'],
        'quotes:read' => ['quotes.view'],
        'quotes:write' => ['quotes.view', 'quotes.create'],
        'reservations:read' => ['reservations.view'],
        'reservations:write' => ['reservations.view', 'reservations.create'],
        'payments:read' => ['finance.receivables'],
        'invoices:read' => ['finance.invoicing'],
        'operations:read' => ['operations.view'],
        'webhooks:manage' => ['admin.api.manage'],
    ];

    public static function apply(Router $router): void
    {
        foreach ($router->getRoutes()->getRoutes() as $route) {
            $scope = self::ROUTES[(string) $route->getName()] ?? null;

            if ($scope !== null) {
                $route->middleware([AuthenticateApiKey::class, RequireApiScope::class.':'.$scope]);
            }
        }
    }

    public static function permissions(array $scopes): array
    {
        return collect($scopes)->flatMap(fn (string $scope): array => self::PERMISSIONS[$scope] ?? [])->unique()->values()->all();
    }

    public static function unknown(Router $router): array
    {
        $names = collect($router->getRoutes()->getRoutes())->map(fn ($route) => (string) $route->getName())->flip();

        return collect(array_keys(self::ROUTES))->reject(fn (string $name) => $names->has($name))->values()->all();
    }
}
