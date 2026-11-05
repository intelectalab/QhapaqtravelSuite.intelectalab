<?php

declare(strict_types=1);

namespace App\Domain\Shared\Http\Resources;

use Illuminate\Http\Request;

trait RevealsSensitiveAmounts
{
    private const PROFITABILITY = ['finance.profitability', 'catalog.products.view_profitability', 'quotes.approve_internal'];

    protected function isInternalUser(Request $request): bool
    {
        $token = $request->user()?->currentAccessToken();
        $experience = is_object($token) ? ($token->experience ?? null) : null;

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
