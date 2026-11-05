<?php

declare(strict_types=1);

namespace App\Domain\Shared\Http\Resources;

use Illuminate\Http\Request;

/**
 * Reglas de visibilidad de datos sensibles en JsonResource (spec 00 SEC-BR-13; CLAUDE.md backend «Datos sensibles»):
 *
 *  | Dato                              | Quién lo recibe                                                                 |
 *  |-----------------------------------|---------------------------------------------------------------------------------|
 *  | Costos de proveedor               | `finance.profitability`, `catalog.products.view_profitability`, `quotes.approve_internal`, |
 *  |                                   | y Operaciones (SUPUESTO: se identifica por `operations.assign`, que solo tienen TA/MG/OP) |
 *  | Márgenes y utilidad               | `finance.profitability`, `catalog.products.view_profitability`, `quotes.approve_internal` |
 *  | Usuarios externos (portal, B2B…)  | NUNCA costos ni márgenes, tengan el permiso que tengan                           |
 *
 * Los campos se OMITEN de la respuesta (no se envían en null ni enmascarados): usar `$this->when(...)` o
 * `$this->mergeWhen(...)`. Ocultarlos solo en pantalla no basta.
 * «Ventas ve margen solo de sus cotizaciones» (03 §7) se resuelve en el Resource de cotización con `owner_id`.
 */
trait RevealsSensitiveAmounts
{
    private const PROFITABILITY = ['finance.profitability', 'catalog.products.view_profitability', 'quotes.approve_internal'];

    protected function isInternalUser(Request $request): bool
    {
        $token = $request->user()?->currentAccessToken();
        $experience = is_object($token) ? ($token->experience ?? null) : null;

        // personal_access_tokens.experience: backoffice | portal | mobile | platform (spec 00 §3.4)
        return $experience === null || $experience === 'backoffice';
    }

    protected function canSeeMargins(Request $request): bool
    {
        $user = $request->user();

        return $user !== null && $this->isInternalUser($request) && $user->hasAnyPermission(self::PROFITABILITY);
    }

    protected function canSeeCosts(Request $request): bool
    {
        $user = $request->user();

        return $user !== null && $this->isInternalUser($request)
            && ($user->hasAnyPermission(self::PROFITABILITY) || $user->hasPermissionTo('operations.assign'));
    }
}
