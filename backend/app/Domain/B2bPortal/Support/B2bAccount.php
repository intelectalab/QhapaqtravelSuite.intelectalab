<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class B2bAccount
{
    public const CREDIT_ALERT_PCT = 80;

    public function __construct(
        public readonly User $user,
        public readonly object $agency,
        public readonly ?object $client,
        public readonly string $today,
    ) {}

    public static function of(User $user, string $today): self
    {
        if (! RoleExperience::isPortal($user) || $user->agency_id === null) {
            throw ApiException::forbidden('B2B_ONLY', 'Esta sección es solo para agencias aliadas.');
        }

        $agency = $user->agency_id ? DB::table('channel_b2b_agencies')->where('id', $user->agency_id)->whereNull('deleted_at')->first() : null;

        if ($agency === null) {
            throw ApiException::forbidden('B2B-BR-17', 'Tu usuario no está vinculado a una agencia con convenio.');
        }

        if ($agency->status === 'inactiva') {
            throw ApiException::forbidden('B2B-BR-02', 'El convenio de tu agencia está inactivo. Escríbenos para reactivarlo.');
        }

        $clientId = $agency->crm_client_id ?? $user->client_id;
        $client = $clientId ? DB::table('crm_clients')->where('id', $clientId)->whereNull('deleted_at')->first(['id', 'code', 'name', 'email', 'phone', 'owner_id']) : null;

        return new self($user, $agency, $client, $today);
    }

    public function status(): string
    {
        return $this->agency->status === 'activa' && $this->agency->valid_to < $this->today ? 'vencida' : (string) $this->agency->status;
    }

    public function limit(): float
    {
        return round((float) $this->agency->credit_limit, 2);
    }

    public function used(): float
    {
        return round((float) $this->agency->credit_used, 2);
    }

    public function available(): float
    {
        return max(0.0, round($this->limit() - $this->used(), 2));
    }

    public function usagePct(): ?float
    {
        return $this->limit() > 0 ? round($this->used() / $this->limit() * 100, 1) : null;
    }

    public function bookingBlock(): ?string
    {
        return match ($this->status()) {
            'vencida' => 'El convenio venció el '.$this->agency->valid_to.'. No es posible reservar hasta renovarlo.',
            'inactiva' => 'El convenio está inactivo. No es posible reservar.',
            default => null,
        };
    }

    public function creditBlock(): ?string
    {
        return match (true) {
            $this->bookingBlock() !== null => $this->bookingBlock(),
            $this->status() === 'bloqueada' => 'Tu línea de crédito está bloqueada. Puedes reservar con prepago.',
            $this->limit() <= 0 => 'Tu convenio no incluye línea de crédito. Reserva con prepago.',
            default => null,
        };
    }

    public function reservations(): Builder
    {
        return DB::table('booking_reservations')
            ->whereNull('deleted_at')
            ->where('channel', 'B2B')
            ->where(fn (Builder $query) => $query->where('agency_id', $this->agency->id)
                ->when($this->agency->crm_client_id, fn (Builder $inner) => $inner->orWhere(fn (Builder $own) => $own->whereNull('agency_id')->where('client_id', $this->agency->crm_client_id))));
    }

    public function reservation(string $code): object
    {
        return $this->reservations()->where('code', $code)->first() ?? throw ApiException::notFound('No encontramos esa reserva en tu agencia.');
    }

    public function receivable(string $code): object
    {
        return DB::table('fin_receivables')->where('code', $code)->whereNull('deleted_at')->where('status', '<>', 'cancelada')
            ->whereIn('reservation_id', $this->reservations()->select('id'))
            ->first() ?? throw ApiException::notFound('No encontramos esa cuota en tu agencia.');
    }
}
