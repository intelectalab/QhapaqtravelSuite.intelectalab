<?php

declare(strict_types=1);

namespace App\Domain\Platform\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class Plan extends Model
{
    use HasUuids;

    protected $table = 'plans';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'price_month' => 'decimal:2',
            'price_year' => 'decimal:2',
            'gateway_price_ids' => 'array',
        ];
    }
}
