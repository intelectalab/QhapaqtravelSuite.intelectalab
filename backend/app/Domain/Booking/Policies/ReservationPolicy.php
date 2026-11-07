<?php

declare(strict_types=1);

namespace App\Domain\Booking\Policies;

use App\Domain\Booking\Models\Reservation;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;

final class ReservationPolicy
{
    public function view(User $user, Reservation $reservation): bool
    {
        if (Portfolio::ownOnly($user) && (string) $reservation->owner_id !== (string) $user->getKey()) {
            throw ApiException::forbidden(
                'SEC-BR-09',
                'Esta reserva pertenece a la cartera de otro asesor. Si necesitas trabajarla, pide a tu gerente que te la reasigne.',
            );
        }

        return true;
    }
}
