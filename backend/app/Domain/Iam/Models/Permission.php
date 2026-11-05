<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Spatie\Permission\Models\Permission as SpatiePermission;

final class Permission extends SpatiePermission
{
    use HasUuids;

    public $timestamps = false;
}
