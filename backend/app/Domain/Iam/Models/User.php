<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

final class User extends Authenticatable
{
    use BelongsToTenant;
    use HasApiTokens;
    use HasRoles;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'iam_users';

    protected string $guard_name = 'api';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'mfa_enabled' => 'boolean',
            'mfa_required' => 'boolean',
            'last_login_at' => 'immutable_datetime',
            'invited_at' => 'immutable_datetime',
            'deactivated_at' => 'immutable_datetime',
        ];
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class, 'sede_id');
    }

    public function mfaFactor(): HasOne
    {
        return $this->hasOne(MfaFactor::class, 'user_id')->whereNotNull('confirmed_at');
    }

    public function isActive(): bool
    {
        return $this->status === 'activo';
    }

    public function primaryRole(): ?Role
    {
        $role = $this->roles->first();

        return $role instanceof Role ? $role : null;
    }

    public function needsMfa(): bool
    {
        return $this->mfa_required || $this->mfa_enabled;
    }
}
