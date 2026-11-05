<?php

declare(strict_types=1);

namespace App\Domain\Platform\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class Tenant extends Model
{
    use HasUuids;

    protected $table = 'tenants';

    protected $guarded = ['id', 'lock_version', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'trial_ends_at' => 'immutable_datetime',
            'suspended_at' => 'immutable_datetime',
            'mrr' => 'decimal:2',
            'modules' => 'integer',
            'storage_used_bytes' => 'integer',
            'lock_version' => 'integer',
        ];
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspendido';
    }
}
