<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class MfaFactor extends Model
{
    use BelongsToTenant;
    use HasUuids;

    public const UPDATED_AT = null;

    protected $table = 'iam_mfa_factors';

    protected $guarded = ['id', 'created_at'];

    protected $hidden = ['secret', 'recovery_codes'];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'recovery_codes' => 'array',
            'confirmed_at' => 'immutable_datetime',
            'last_used_step' => 'integer',
        ];
    }
}
