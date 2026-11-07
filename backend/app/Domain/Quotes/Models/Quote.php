<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Models;

use App\Domain\Booking\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Shared\Concurrency\HasLockVersion;
use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Quote extends Model
{
    use BelongsToTenant;
    use HasLockVersion;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'quote_quotes';

    protected $fillable = ['title', 'client_id', 'opportunity_id', 'travel_from', 'travel_to', 'valid_until', 'pax_adt', 'pax_chd', 'pax_inf'];

    protected function casts(): array
    {
        return [
            'travel_from' => 'immutable_date',
            'travel_to' => 'immutable_date',
            'valid_until' => 'immutable_date',
            'fx_rate' => 'decimal:6',
            'pax_adt' => 'integer',
            'pax_chd' => 'integer',
            'pax_inf' => 'integer',
            'current_version_no' => 'integer',
            'approval_version_no' => 'integer',
            'lock_version' => 'integer',
            'approved_at' => 'immutable_datetime',
            'converted_at' => 'immutable_datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class, 'reservation_id');
    }

    public function resolveRouteBinding($value, $field = null): ?Model
    {
        $column = $field ?? (preg_match('/^[0-9a-f-]{36}$/i', (string) $value) === 1 ? 'id' : 'code');

        return $this->newQuery()->where($column, $value)->first();
    }

    public function statusEnum(): QuoteStatus
    {
        return QuoteStatus::from((string) $this->status);
    }

    public function paxTotal(): int
    {
        return (int) $this->pax_adt + (int) $this->pax_chd + (int) $this->pax_inf;
    }

    protected function lockVersionLabel(): string
    {
        return 'La cotización';
    }
}
