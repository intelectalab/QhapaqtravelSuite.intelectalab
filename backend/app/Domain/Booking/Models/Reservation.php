<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Concurrency\HasLockVersion;
use App\Domain\Shared\Money\MoneyCast;
use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Reservation extends Model
{
    use BelongsToTenant;
    use HasLockVersion;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'booking_reservations';

    protected $fillable = ['title', 'notes', 'travel_from', 'travel_to'];

    protected function casts(): array
    {
        return [
            'travel_from' => 'immutable_date',
            'travel_to' => 'immutable_date',
            'fx_rate' => 'decimal:6',
            'total_amount' => MoneyCast::class.':currency',
            'penalty_amount' => MoneyCast::class.':currency',
            'refund_amount' => MoneyCast::class.':currency',
            'catalog_snapshot' => 'array',
            'policies_snapshot' => 'array',
            'quote_version_no' => 'integer',
            'lock_version' => 'integer',
            'rescheduled_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function services(): HasMany
    {
        return $this->hasMany(ReservationService::class, 'reservation_id')->orderBy('service_date')->orderBy('code');
    }

    public function resolveRouteBinding($value, $field = null): ?Model
    {
        $column = $field ?? (preg_match('/^[0-9a-f-]{36}$/i', (string) $value) === 1 ? 'id' : 'code');

        return $this->newQuery()->where($column, $value)->first();
    }

    public function statusEnum(): ReservationStatus
    {
        return ReservationStatus::from((string) $this->status);
    }

    protected function lockVersionLabel(): string
    {
        return 'La reserva';
    }
}
