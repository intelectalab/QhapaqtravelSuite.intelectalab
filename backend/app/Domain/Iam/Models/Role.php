<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Spatie\Permission\Models\Role as SpatieRole;

final class Role extends SpatieRole
{
    use HasUuids;

    protected function casts(): array
    {
        return ['is_custom' => 'boolean'];
    }
}
