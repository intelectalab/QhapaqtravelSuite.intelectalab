<?php

declare(strict_types=1);

namespace App\Domain\Iam\Http\Resources;

use App\Domain\Admin\Support\Branding;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class MeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $this->resource;
        assert($user instanceof User);
        $access = RoleExperience::for($user);
        $tenant = app(TenantContext::class)->tenant();
        $role = $user->primaryRole();

        return [
            'id' => $user->getKey(),
            'code' => $user->code,
            'name' => $user->name,
            'email' => $user->email,
            'avatar_color' => $user->avatar_color,
            'role' => ['name' => $access['role'], 'display_name' => $role?->display_name],
            'experience' => $access['experience'],
            'home' => $access['home'],
            'mfa_enabled' => $user->mfa_enabled,
            'mfa_required' => $user->mfaMandatory(),
            'sede' => ['id' => $user->sede?->getKey(), 'name' => $user->sede?->name],
            'tenant' => [
                'id' => $tenant->getKey(),
                'code' => $tenant->code,
                'name' => $tenant->commercial_name,
                'legal_name' => $tenant->legal_name,
                'initials' => $tenant->logo_initials,
                'base_currency' => $tenant->base_currency,
                'timezone' => $tenant->timezone,
                'branding' => app(Branding::class)->current(),
            ],
            'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values(),
        ];
    }
}
