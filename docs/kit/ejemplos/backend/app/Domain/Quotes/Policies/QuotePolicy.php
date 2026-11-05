<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Policies;

use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Errors\ApiException;

/**
 * Policy de cotizaciones (CONVENCIONES §3: «Policy por modelo + permisos spatie con teams = tenant»).
 *
 * Capas de autorización de una solicitud:
 *  1. Middleware de ruta `permission:reservations.create` (spatie) → 403 con `required_permissions`.
 *  2. Route model binding con BelongsToTenant + RLS → recurso de otro tenant = 404 RESOURCE_NOT_FOUND.
 *  3. ESTA policy → alcance: ownership de Ventas (SEC-BR-09) y vínculo de usuarios externos (SEC-BR-12).
 *
 * Alcance por rol (spec 00 §7.6/§7.7; GET /me devuelve `own | tenant | linked`):
 *  - `own`    : rol `sales` → solo registros con owner_id = usuario. Detalle ajeno → 403 SEC-BR-09.
 *  - `linked` : roles externos → solo lo vinculado a su cuenta (cliente → client_id; B2B → agency_id…).
 *  - `tenant` : resto de roles internos (tenant_admin, manager, operations, finance, accounting).
 * SUPUESTO: el alcance se deriva del nombre del rol semilla; para roles personalizados se usa `roles.scope`
 * (spec 00 §3.5) y la experiencia del token. Mantener la tabla de alcance en un único lugar (DataScope).
 */
final class QuotePolicy
{
    public function view(User $user, Quote $quote): bool
    {
        $this->assertInScope($user, $quote);

        return true;
    }

    /** Convertir en reserva: además del permiso, Ventas solo sobre su cartera (T-R13 / Pest «Ventas no convierte ajenas»). */
    public function convert(User $user, Quote $quote): bool
    {
        $this->assertInScope($user, $quote);

        return true;
    }

    private function assertInScope(User $user, Quote $quote): void
    {
        $scope = self::dataScope($user);

        if ($scope === 'own' && $quote->owner_id !== $user->id) {
            throw ApiException::forbidden(
                'SEC-BR-09',
                'Esta cotización pertenece a la cartera de otro asesor. Si necesita trabajarla, solicite a su gerente la reasignación.',
            );
        }

        if ($scope === 'linked' && ($user->client_id === null || $quote->client_id !== $user->client_id)) {
            // Para externos no se revela la existencia: mismo trato que otro tenant.
            throw ApiException::notFound();
        }
    }

    /** @return 'own'|'tenant'|'linked' */
    public static function dataScope(User $user): string
    {
        return match (true) {
            $user->hasRole('sales') => 'own',
            $user->hasAnyRole(['customer', 'passenger', 'b2b', 'provider', 'guide', 'driver']) => 'linked',
            default => 'tenant',
        };
    }
}
