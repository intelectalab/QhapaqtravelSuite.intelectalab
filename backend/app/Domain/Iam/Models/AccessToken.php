<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Laravel\Sanctum\PersonalAccessToken;

final class AccessToken extends PersonalAccessToken
{
    use HasUuids;

    protected $table = 'personal_access_tokens';

    protected $fillable = ['tenant_id', 'name', 'token', 'abilities', 'experience', 'expires_at', 'device_name', 'ip'];

    protected function casts(): array
    {
        return [
            'abilities' => 'json',
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'mfa_verified_at' => 'immutable_datetime',
        ];
    }

    public static function findToken($token): ?static
    {
        $found = parent::findToken($token);

        if ($found instanceof self && $found->tenant_id !== null) {
            app(TenantDatabase::class)->run($found->tenant_id, fn () => $found->load('tokenable'));
        }

        return $found;
    }

    public function isMfaVerified(): bool
    {
        return $this->mfa_verified_at !== null;
    }
}
