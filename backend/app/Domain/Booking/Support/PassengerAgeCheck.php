<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use Illuminate\Support\Facades\DB;

final class PassengerAgeCheck
{
    public const LABELS = ['ADT' => 'adulto', 'CHD' => 'niño', 'INF' => 'infante', 'NA' => 'sin tipo admitido'];

    private array $types = [];

    public function __construct(private readonly TenantBookingEngine $engines) {}

    public function expected(string $reservationId, ?int $age): ?string
    {
        if ($age === null) {
            return null;
        }

        $key = "{$reservationId}#{$age}";

        if (array_key_exists($key, $this->types)) {
            return $this->types[$key];
        }

        $service = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->whereNotNull('product_id')->where('status', '<>', 'cancelado')
            ->orderBy('service_date')->first(['product_id', 'service_date']);

        return $this->types[$key] = $service === null ? null : $this->engines->engine()->ageType($this->engines->product((string) $service->product_id, (string) $service->service_date), $age);
    }

    public function warning(string $reservationId, ?int $age, string $paxType): ?string
    {
        $expected = $this->expected($reservationId, $age);

        if ($expected === null || $expected === $paxType) {
            return null;
        }

        return "Con {$age} años a la fecha del viaje le corresponde el tipo ".self::LABELS[$expected].' según las reglas del producto, y está registrado como '.self::LABELS[$paxType].'. Si corresponde, pide una modificación de la reserva.';
    }
}
