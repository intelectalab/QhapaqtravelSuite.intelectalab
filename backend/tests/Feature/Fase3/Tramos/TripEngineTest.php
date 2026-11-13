<?php

use App\Domain\Booking\BookingEngine;
use App\Domain\Booking\Data\FxTable;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Booking\Data\SeasonCalendar;
use App\Domain\Booking\Testing\InMemoryInventory;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Database\Support\KitSeeds;

function tramosEngine(array $ruleOverrides = []): array
{
    $settings = KitSeeds::read('settings');
    $rules = collect($settings['bookingRules'])->map(fn ($r) => array_key_exists($r['id'], $ruleOverrides) ? [...$r, 'enabled' => $ruleOverrides[$r['id']]] : $r)->all();
    $engine = new BookingEngine(
        rules: RuleSet::fromArray($rules, plan: 'Enterprise', planOrder: ['Starter', 'Professional', 'Enterprise']),
        fx: FxTable::fromArray($settings['ecommerce']['currencies'], chargeCurrencies: $settings['ecommerce']['chargeCurrencies'], baseCurrency: 'PEN'),
        seasons: SeasonCalendar::fromArray(KitSeeds::read('seasons')),
        inventory: InMemoryInventory::fromReservations(KitSeeds::read('reservations')),
        ecommerceDefaults: $settings['ecommerce'],
        today: '2026-09-29',
    );

    return [$engine, ProductData::fromArray(collect(KitSeeds::read('products'))->firstWhere('id', 'PRD-011'))];
}

function tramosSelection(array $extra = []): QuoteSelection
{
    return QuoteSelection::fromArray([
        'date' => '2026-10-12',
        'pax' => ['adt' => 2, 'chd' => 0, 'inf' => 0],
        'lodging' => [
            ['leg_id' => 'LEG-1', 'hotel_id' => 'H-LIM-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
            ['leg_id' => 'LEG-2', 'hotel_id' => 'H-AQP-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
            ['leg_id' => 'LEG-3', 'hotel_id' => 'H-PUN-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
            ['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
        ],
        'currency' => 'PEN',
        ...$extra,
    ]);
}

function tramosLine($quote, string $key)
{
    return collect($quote->lines)->firstWhere('key', $key);
}

it('TB-02: acota las noches al máximo del tramo, avisa y mueve las fechas de los tramos siguientes', function () {
    [$engine, $product] = tramosEngine();
    $quote = $engine->quote($product, tramosSelection(['nights' => ['LEG-2' => 9]]));

    $arequipa = collect($quote->legs)->firstWhere('legId', 'LEG-2');
    expect($arequipa['nights'])->toBe(4)
        ->and($arequipa['checkIn'])->toBe('2026-10-13')
        ->and($arequipa['checkOut'])->toBe('2026-10-17')
        ->and(collect($quote->legs)->firstWhere('legId', 'LEG-3')['checkIn'])->toBe('2026-10-17')
        ->and($quote->tripEnd)->toBe('2026-10-23')
        ->and(tramosLine($quote, 'lodge-LEG-2-Doble')->qty)->toBe(4)
        ->and($quote->warnings)->toContain('Arequipa admite de 1 a 4 noche(s): se ajustó a 4.');
});

it('TB-03: cada noche se cobra con la tarifa de su fecha cuando la estadía cruza la temporada alta', function () {
    [$engine, $product] = tramosEngine();
    $crossing = $engine->quote($product, tramosSelection(['date' => '2026-08-25']));
    $plain = $engine->quote($product, tramosSelection(['date' => '2026-10-12']));

    $line = tramosLine($crossing, 'lodge-LEG-4-Doble');
    $ratio = BigDecimal::of((string) $line->unit->getAmount())->dividedBy((string) tramosLine($plain, 'lodge-LEG-4-Doble')->unit->getAmount(), 3, RoundingMode::HALF_UP);

    expect($line->meta['seasonal'])->toBeTrue()
        ->and($line->label)->toContain('Temporada alta +20 %')
        ->and((string) $ratio)->toBe('1.100')
        ->and(tramosLine($plain, 'lodge-LEG-4-Doble')->meta['seasonal'])->toBeFalse();
});

it('TB-04: el tour cobra adultos y niños, respeta la edad mínima con aviso y los infantes no pagan', function () {
    [$engine, $product] = tramosEngine();
    $quote = $engine->quote($product, tramosSelection(['pax' => ['adt' => 2, 'chd' => 1, 'inf' => 1], 'tours' => [['id' => 'TT-AQP-2'], ['id' => 'TT-CUS-2']]]));
    $usd = $engine->quote($product, tramosSelection(['pax' => ['adt' => 2, 'chd' => 1, 'inf' => 1], 'tours' => ['TT-AQP-2', 'TT-CUS-2'], 'currency' => 'USD']));

    expect(tramosLine($usd, 'tour-TT-AQP-2')->amount->getAmount()->toFloat())->toBe(90.0)
        ->and(tramosLine($usd, 'tour-TT-AQP-2')->meta['chd'])->toBe(0)
        ->and(tramosLine($usd, 'tour-TT-CUS-2')->amount->getAmount()->toFloat())->toBe(162.0)
        ->and(tramosLine($usd, 'tour-TT-CUS-2')->meta['date'])->toBe('2026-10-18')
        ->and($quote->warnings)->toContain('Rafting en el río Chili: edad mínima 12 años; los niños menores no participan.');
});

it('TB-05: por vehículo elige el más chico que alcanza y, si ninguno alcanza, varias unidades del más grande', function () {
    [$engine, $product] = tramosEngine();
    $five = $engine->quote($product, tramosSelection(['pax' => ['adt' => 5, 'chd' => 0, 'inf' => 0], 'transport' => ['TR-AQP-PUN-P'], 'currency' => 'USD']));
    $twelve = $engine->quote($product, tramosSelection(['pax' => ['adt' => 12, 'chd' => 0, 'inf' => 0], 'transport' => ['TR-AQP-PUN-P'], 'currency' => 'USD']));

    expect(tramosLine($five, 'trans-TR-AQP-PUN-P')->meta['vehicle'])->toBe('Van (4–10)')
        ->and(tramosLine($five, 'trans-TR-AQP-PUN-P')->meta['units'])->toBe(1)
        ->and(tramosLine($five, 'trans-TR-AQP-PUN-P')->amount->getAmount()->toFloat())->toBe(340.0)
        ->and(tramosLine($twelve, 'trans-TR-AQP-PUN-P')->meta['units'])->toBe(2)
        ->and(tramosLine($twelve, 'trans-TR-AQP-PUN-P')->amount->getAmount()->toFloat())->toBe(680.0);
});

it('TB-06: elegir bus y luego vuelo entre Lima y Arequipa deja solo el vuelo', function () {
    [$engine, $product] = tramosEngine();
    $quote = $engine->quote($product, tramosSelection(['transport' => ['TR-LIM-AQP-B', 'TR-LIM-AQP-V', 'TL-LIM-APT']]));

    expect(tramosLine($quote, 'trans-TR-LIM-AQP-B'))->toBeNull()
        ->and(tramosLine($quote, 'trans-TR-LIM-AQP-V'))->not->toBeNull()
        ->and(tramosLine($quote, 'trans-TL-LIM-APT'))->not->toBeNull()
        ->and(tramosLine($quote, 'trans-TR-LIM-AQP-V')->meta['date'])->toBe('2026-10-13');
});

it('TB-07: el gasto por categoría suma el subtotal sin las líneas quitadas', function () {
    [$engine, $product] = tramosEngine();
    $quote = $engine->quote($product, tramosSelection(['tours' => ['TT-CUS-2'], 'transport' => ['TR-LIM-AQP-V'], 'nights' => ['LEG-4' => 5], 'removed' => ['tour-TT-CUS-2']]));
    $sum = collect($quote->byCategory)->reduce(fn ($carry, $money) => $carry->plus($money->getAmount()), BigDecimal::zero());

    expect((string) $sum->toScale(2))->toBe((string) $quote->subtotal->getAmount())
        ->and($quote->byCategory['tour']->isZero())->toBeTrue()
        ->and($quote->byCategory['transport']->isPositive())->toBeTrue()
        ->and($quote->byCategory['lodging']->isPositive())->toBeTrue();
});

it('TB-01: con la regla apagada las noches son fijas y se ignoran tours y movilidad', function () {
    [$engine, $product] = tramosEngine(['R-TRIP-BUILDER' => false]);
    $quote = $engine->quote($product, tramosSelection(['nights' => ['LEG-4' => 6], 'tours' => ['TT-CUS-2'], 'transport' => ['TR-LIM-AQP-V']]));

    expect(collect($quote->legs)->firstWhere('legId', 'LEG-4')['nights'])->toBe(4)
        ->and(collect($quote->lines)->whereIn('kind', ['tour', 'transport'])->count())->toBe(0)
        ->and(tramosLine($quote, 'lodge-LEG-4-Doble')->meta['seasonal'])->toBeFalse();
});
