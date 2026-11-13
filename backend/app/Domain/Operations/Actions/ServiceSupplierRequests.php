<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Booking\Actions\ReservationServiceRequests;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ServiceSupplierRequests
{
    public function __construct(private readonly ReservationServiceRequests $requests) {}

    public function request(string $reference, ?string $note, User $actor): object
    {
        [$reservation, $service] = $this->locate($reference);

        return $this->requests->request($reservation, $service, $note, $actor);
    }

    public function confirm(string $reference, array $data, User $actor): object
    {
        [$reservation, $service] = $this->locate($reference);

        return $this->requests->confirm($reservation, $service, $data, $actor);
    }

    public function reject(string $reference, array $data, User $actor): object
    {
        [$reservation, $service] = $this->locate($reference);

        return $this->requests->reject($reservation, $service, $data, $actor);
    }

    private function locate(string $reference): array
    {
        $row = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->whereNull('r.deleted_at')
            ->where(Str::isUuid($reference) ? 's.id' : 's.code', $reference)->first(['s.code', 'r.code as reservation_code'])
            ?? throw ApiException::notFound('El servicio no existe.');

        return [(string) $row->reservation_code, (string) $row->code];
    }
}
