<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/**
 * Selección del cliente = cuerpo de POST /api/v1/public/quote (spec 16 §6.1):
 * product_id, date, pax{adt,chd,inf}, addons[{id,qty}], lodging[{leg_id,hotel_id,rooms[{type,qty}]}], options[],
 * currency, payment_mode, payment_method, promo_code, removed[], channel.
 */
final readonly class QuoteSelection
{
    /**
     * @param  array{adt:int,chd:int,inf:int}  $pax
     * @param  list<array{id:string,qty:int}>  $addons
     * @param  list<array<string, mixed>>  $lodging
     * @param  list<array<string, string>>  $options
     * @param  list<string>  $removed
     */
    public function __construct(
        public ?string $date,
        public array $pax,
        public array $addons = [],
        public array $lodging = [],
        public array $options = [],
        public string $currency = 'PEN',
        public ?string $paymentMode = null,
        public ?string $paymentMethod = null,
        public ?string $promoCode = null,
        public array $removed = [],
        public string $channel = 'Directo',
    ) {
    }

    public static function fromArray(array $s): self
    {
        $pax = (array) ($s['pax'] ?? []);

        return new self(
            date: $s['date'] ?? null,
            pax: ['adt' => (int) ($pax['adt'] ?? 1), 'chd' => (int) ($pax['chd'] ?? 0), 'inf' => (int) ($pax['inf'] ?? 0)],
            addons: array_values((array) ($s['addons'] ?? [])),
            lodging: array_values((array) ($s['lodging'] ?? [])),
            options: array_values((array) ($s['options'] ?? [])),
            currency: (string) ($s['currency'] ?? 'PEN'),
            paymentMode: $s['paymentMode'] ?? $s['payment_mode'] ?? null,
            paymentMethod: $s['paymentMethod'] ?? $s['payment_method'] ?? null,
            promoCode: $s['promoCode'] ?? $s['promo_code'] ?? null,
            removed: array_values((array) ($s['removed'] ?? [])),
            channel: (string) ($s['channel'] ?? 'Directo'),
        );
    }
}
