<?php

declare(strict_types=1);

namespace App\Domain\Platform\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

final class PlatformUser extends Authenticatable
{
    use HasApiTokens;
    use HasUuids;

    protected $connection = 'pgsql_platform';

    protected $table = 'platform_users';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $hidden = ['password', 'mfa_secret'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'mfa_secret' => 'encrypted',
            'last_login_at' => 'immutable_datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'activo';
    }

    public function hasPlatformPermission(string $permission): bool
    {
        return $this->isActive() && in_array($permission, config('access.platform_permissions', []), true);
    }
}
