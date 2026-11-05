<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Models;

use App\Domain\Bookings\Enums\ReservationStatus;
use App\Domain\Crm\Models\Client;
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

/**
 * Reserva — tabla `booking_reservations` (database/20_fase1.sql; columnas de fase 2 en 30_fase2.sql:
 * ecom_order_id, b2b_terms, cancel_request_id).
 *
 * - HasUuids genera UUID v7 en Laravel 12 (PK ordenable). BelongsToTenant: global scope + tenant_id del contexto.
 * - `status` (string) solo cambia vía ReservationStateMachine (nunca update directo).
 * - Montos con MoneyCast (moneda de la fila `currency`); `fx_rate` como string decimal (numeric(12,6)).
 *
 * @property string $id
 * @property string $code
 * @property string $status  valor de ReservationStatus
 * @property int $lock_version
 */
final class Reservation extends Model
{
    use BelongsToTenant;
    use HasLockVersion;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'booking_reservations';

    /** Solo campos editables por formulario; código, estado, montos y snapshots los asignan las Actions. */
    protected $fillable = ['title', 'notes', 'travel_from', 'travel_to'];

    protected function casts(): array
    {
        return [
            // `status` queda como string (valores del CHECK): las plantillas Pest comparan con strings
            // (`->status)->toBe('convertida')`). El enum ReservationStatus se usa en la máquina de estados y en validaciones.
            'travel_from' => 'immutable_date',
            'travel_to' => 'immutable_date',
            'fx_rate' => 'decimal:6',
            'total_amount' => MoneyCast::class.':currency',
            'penalty_amount' => MoneyCast::class.':currency',
            'refund_amount' => MoneyCast::class.':currency',
            'catalog_snapshot' => 'array',
            'policies_snapshot' => 'array',
            'b2b_terms' => 'array',
            'quote_version_no' => 'integer',
            'lock_version' => 'integer',
            'rescheduled_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Quote, $this> */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return HasMany<ReservationService, $this> */
    public function services(): HasMany
    {
        return $this->hasMany(ReservationService::class, 'reservation_id')->orderBy('service_date')->orderBy('code');
    }

    /** Route model binding: acepta uuid o código legible (contrato: «el backend acepta UUID o code»). */
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
