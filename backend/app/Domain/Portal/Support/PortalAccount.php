<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PortalAccount
{
    public const CLIENT_COLUMNS = ['id', 'code', 'name', 'kind', 'email', 'phone', 'country', 'city', 'doc_type', 'doc_number', 'birth_date', 'owner_id'];

    public function __construct(
        public readonly User $user,
        public readonly string $role,
        public readonly object $client,
        public readonly ?string $reservationId,
    ) {}

    public static function of(User $user): self
    {
        $role = RoleExperience::for($user)['role'];

        if (! in_array($role, ['customer', 'passenger'], true)) {
            throw ApiException::forbidden('PORTAL_ONLY', 'Esta sección es solo para clientes y pasajeros.');
        }

        if ($role === 'passenger') {
            $reservation = $user->reservation_id ? DB::table('booking_reservations')->where('id', $user->reservation_id)->whereNull('deleted_at')->first(['id', 'client_id']) : null;
            if ($reservation === null) {
                throw ApiException::forbidden('PPX-BR-01', 'No encontramos un viaje vinculado a tu cuenta.');
            }
            $clientId = $reservation->client_id;
        } else {
            $clientId = $user->client_id;
        }

        $client = $clientId ? DB::table('crm_clients')->where('id', $clientId)->whereNull('deleted_at')->first(self::CLIENT_COLUMNS) : null;

        if ($client === null) {
            throw ApiException::forbidden('PCL-BR-01', 'Tu usuario no está vinculado a una cuenta de cliente.');
        }

        return new self($user, $role, $client, $role === 'passenger' ? (string) $user->reservation_id : null);
    }

    public function isPassenger(): bool
    {
        return $this->role === 'passenger';
    }

    public function reservations(): Collection
    {
        return DB::table('booking_reservations')
            ->where('client_id', $this->client->id)
            ->when($this->reservationId, fn ($query) => $query->where('id', $this->reservationId))
            ->whereNull('deleted_at')
            ->where('status', '<>', 'borrador')
            ->orderByDesc('travel_from')
            ->get(['id', 'code', 'title', 'status', 'travel_from', 'travel_to', 'total_amount', 'currency', 'fx_rate', 'owner_id']);
    }

    public function reservation(string $code): object
    {
        return $this->reservations()->firstWhere('code', $code) ?? throw ApiException::notFound('No encontramos ese viaje en tu cuenta.');
    }

    public function receivable(string $code): object
    {
        if ($this->isPassenger()) {
            throw ApiException::notFound('No encontramos esa cuota en tu cuenta.');
        }

        return DB::table('fin_receivables')->where('code', $code)->where('client_id', $this->client->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->first()
            ?? throw ApiException::notFound('No encontramos esa cuota en tu cuenta.');
    }

    public function quote(string $code): object
    {
        if ($this->isPassenger()) {
            throw ApiException::notFound('No encontramos esa propuesta en tu cuenta.');
        }

        return DB::table('quote_quotes')->where('code', $code)->where('client_id', $this->client->id)->whereNull('deleted_at')->where('status', '<>', 'borrador')->first()
            ?? throw ApiException::notFound('No encontramos esa propuesta en tu cuenta.');
    }

    public function advisorId(): ?string
    {
        return $this->client->owner_id ?? $this->reservations()->first()?->owner_id;
    }
}
