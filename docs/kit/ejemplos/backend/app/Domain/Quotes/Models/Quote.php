<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Models;

use App\Domain\Bookings\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Shared\Concurrency\HasLockVersion;
use App\Domain\Shared\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Cotización — tabla `quote_quotes` (database/20_fase1.sql). Versiones en `quote_versions`, ítems en `quote_items`.
 *
 * @property string $id
 * @property string $code
 * @property string $status  valor de QuoteStatus
 * @property string $owner_id
 * @property string|null $reservation_id
 * @property string|null $current_version_id
 * @property int $lock_version
 */
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
            // `status` queda como string (valores del CHECK): las plantillas Pest comparan con strings
            // (`->status)->toBe('convertida')`). El enum QuoteStatus se usa en la máquina de estados y en validaciones.
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

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsTo<Reservation, $this> */
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

    protected function lockVersionLabel(): string
    {
        return 'La cotización';
    }
}
