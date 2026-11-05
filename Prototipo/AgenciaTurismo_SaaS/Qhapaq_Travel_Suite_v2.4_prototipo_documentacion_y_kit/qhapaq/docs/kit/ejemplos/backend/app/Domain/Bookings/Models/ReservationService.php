<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Models;

use App\Domain\Shared\Concurrency\HasLockVersion;
use App\Domain\Shared\Money\MoneyCast;
use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Servicio de una reserva — tabla `booking_reservation_services` (nombre unificado C-29; la spec 04 la llama
 * `booking_services`). Montos de línea `cost_amount` / `price_amount` (sin IGV) + `currency` + `fx_rate`.
 */
final class ReservationService extends Model
{
    use BelongsToTenant;
    use HasLockVersion;
    use HasUuids;

    protected $table = 'booking_reservation_services';

    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'service_date' => 'immutable_date',
            'pax' => 'integer',
            'fx_rate' => 'decimal:6',
            'cost_amount' => MoneyCast::class.':currency',
            'price_amount' => MoneyCast::class.':currency',
            'is_required' => 'boolean',
            'requires_assignment' => 'boolean',
            'lock_version' => 'integer',
        ];
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class, 'reservation_id');
    }
}
