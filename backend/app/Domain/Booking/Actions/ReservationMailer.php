<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class ReservationMailer
{
    public function __construct(private readonly TenantContext $context) {}

    public function send(string $reservationId, string $subject, string $message): void
    {
        $row = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.id', $reservationId)->first(['r.code', 'c.name', 'c.email']);

        if (! $row || ! $row->email) {
            return;
        }

        $agency = $this->context->tenant()->commercial_name;
        $body = "Hola, {$row->name}:\n\n{$message}\n\nReserva {$row->code}\n{$agency}";

        app(QueuedMail::class)->send((string) $row->email, (string) $row->name, "{$subject} · {$agency}", $body);
    }
}
