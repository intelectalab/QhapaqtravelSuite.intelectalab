<?php

use App\Domain\Booking\BookingEngine;
use App\Domain\Booking\Data\FxTable;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Booking\Data\SeasonCalendar;
use App\Domain\Booking\Testing\InMemoryInventory;
use Database\Support\KitSeeds;

require_once __DIR__.'/../../Datasets/prd011.php';

beforeEach(function () {
    if (! class_exists(BookingEngine::class)) {
        $this->markTestSkipped('Fase B: falta App\Domain\Booking\BookingEngine (motor puro de la esp. 16, PRD-BR-010, H-13). Valores esperados del prototipo en tests/Datasets/prd011.php.');
    }
});

function engineFromSeeds(array $ruleOverrides = [], string $plan = 'Enterprise'): array
{
    $settings = KitSeeds::read('settings');
    $products = KitSeeds::read('products');
    $seasons = KitSeeds::read('seasons');
    $reservations = KitSeeds::read('reservations');

    $rules = collect($settings['bookingRules'])
        ->map(fn ($r) => array_key_exists($r['id'], $ruleOverrides) ? [...$r, 'enabled' => $ruleOverrides[$r['id']]] : $r)
        ->all();

    $engine = new BookingEngine(
        rules: RuleSet::fromArray($rules, plan: $plan, planOrder: ['Starter', 'Professional', 'Enterprise']),
        fx: FxTable::fromArray($settings['ecommerce']['currencies'], chargeCurrencies: $settings['ecommerce']['chargeCurrencies'], baseCurrency: 'PEN'),
        seasons: SeasonCalendar::fromArray($seasons),
        inventory: InMemoryInventory::fromReservations($reservations),
        ecommerceDefaults: $settings['ecommerce'],
        today: BUSINESS_TODAY,
    );
    $product = ProductData::fromArray(collect($products)->firstWhere('id', 'PRD-011'));

    return [$engine, $product];
}

function linesByKey($quote): array
{
    return collect($quote->lines)->keyBy('key')->map(fn ($l) => [
        'qty' => $l->qty, 'unit' => $l->unit->getAmount()->toString(), 'amount' => $l->amount->getAmount()->toString(), 'removable' => $l->removable,
    ])->all();
}

describe('BookingEngine::quote · PRD-011 canónico (PEN)', function () {
    it('calcula cada línea igual que el prototipo', function () {
        [$engine, $p] = engineFromSeeds();
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect(linesByKey($q))->toEqual(PRD011_EXPECTED_PEN['lines']);
    });

    it('totales, adelanto 30 %, saldo y vencimiento', function () {
        [$engine, $p] = engineFromSeeds();
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->subtotal->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['subtotal'])
            ->and($q->total->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['total'])
            ->and($q->paymentMode)->toBe('adelanto')
            ->and($q->modes)->toBe(PRD011_EXPECTED_PEN['modes'])
            ->and($q->depositPct)->toBe(30)
            ->and($q->deposit->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['deposit'])
            ->and($q->balance->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['balance'])
            ->and($q->balanceDue?->toDateString())->toBe(PRD011_EXPECTED_PEN['balance_due'])
            ->and($q->warnings)->toBe(PRD011_EXPECTED_PEN['warnings'])
            ->and($q->rooms)->toBe(8)
            ->and($q->nights)->toBe(9)
            ->and($q->season?->name)->toBe(PRD011_EXPECTED_PEN['season'])
            ->and($q->ok)->toBeTrue();
    });

    it('deposit + balance = total exacto (sin perder céntimos)', function () {
        [$engine, $p] = engineFromSeeds();
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->deposit->plus($q->balance)->getAmount()->toString())->toBe($q->total->getAmount()->toString());
    });

    it('el infante no paga ni ocupa asiento; el niño usa la tarifa Niño', function () {
        [$engine, $p] = engineFromSeeds();
        $v = $engine->validatePax($p, ['adt' => 2, 'chd' => 1, 'inf' => 1]);

        expect($v->ok)->toBeTrue()->and($v->seats)->toBe(3);
    });
});

describe('BookingEngine::quote · misma selección en USD', function () {
    it('convierte sin margen porque USD es moneda de cobro', function () {
        [$engine, $p] = engineFromSeeds();
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection(['currency' => 'USD'])));

        expect($q->currency)->toBe('USD')
            ->and($q->subtotal->getAmount()->toString())->toBe(PRD011_EXPECTED_USD['subtotal'])
            ->and($q->deposit->getAmount()->toString())->toBe(PRD011_EXPECTED_USD['deposit'])
            ->and($q->balance->getAmount()->toString())->toBe(PRD011_EXPECTED_USD['balance']);
    });
});

describe('Previsualización quitando ítems (R-PREVIEW-REMOVE)', function () {
    it('quitar el adicional baja el total y conserva la línea marcada removed', function () {
        [$engine, $p] = engineFromSeeds();
        $v = PRD011_VARIANTS['removed_addon'];
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection(['removed' => $v['removed']])));

        expect($q->total->getAmount()->toString())->toBe($v['total'])
            ->and($q->deposit->getAmount()->toString())->toBe($v['deposit'])
            ->and(collect($q->lines)->firstWhere('key', 'addon-ADD-1101')->removed)->toBeTrue();
    });

    it('quitar Lima en USD deja 6 habitaciones y 8 noches', function () {
        [$engine, $p] = engineFromSeeds();
        $v = PRD011_VARIANTS['removed_lima_usd'];
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection(['currency' => 'USD', 'removed' => $v['removed']])));

        expect($q->total->getAmount()->toString())->toBe($v['total'])
            ->and($q->rooms)->toBe(6)
            ->and($q->nights)->toBe(8);
    });

    it('las líneas base nunca son removibles aunque se envíen en removed[]', function () {
        [$engine, $p] = engineFromSeeds();
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection(['removed' => ['base-adt']])));

        expect($q->total->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['total']);
    });
});

describe('Reglas activables: regla apagada → sin efecto', function () {
    it('R-LODGING apagada ignora el alojamiento', function () {
        $v = PRD011_VARIANTS['rule_off_lodging'];
        [$engine, $p] = engineFromSeeds(['R-LODGING' => false]);
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->total->getAmount()->toString())->toBe($v['total'])
            ->and($q->rooms)->toBe(0)
            ->and(collect($q->lines)->where('kind', 'lodging'))->toBeEmpty();
    });

    it('R-PREVIEW-REMOVE apagada: removed[] no altera el total y nada es removible', function () {
        $v = PRD011_VARIANTS['rule_off_preview_remove'];
        [$engine, $p] = engineFromSeeds(['R-PREVIEW-REMOVE' => false]);
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection(['removed' => $v['removed']])));

        expect($q->total->getAmount()->toString())->toBe($v['total'])
            ->and(collect($q->lines)->contains(fn ($l) => $l->removable))->toBeFalse();
    });

    it('R-DEPOSIT apagada: solo pago total', function () {
        $v = PRD011_VARIANTS['rule_off_deposit'];
        [$engine, $p] = engineFromSeeds(['R-DEPOSIT' => false]);
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->paymentMode)->toBe('total')
            ->and($q->modes)->toBe(['total'])
            ->and($q->deposit->getAmount()->toString())->toBe($v['deposit'])
            ->and($q->balance->getAmount()->toString())->toBe('0.00')
            ->and($q->balanceDue)->toBeNull();
    });
});

describe('Reglas por plan: plan sin la regla → sin efecto (PLN-R-01)', function () {
    it('en Starter, R-LODGING y R-ADDONS (plan mínimo Professional) no aplican aunque estén enabled', function () {
        $v = PRD011_VARIANTS['plan_starter'];
        [$engine, $p] = engineFromSeeds(plan: 'Starter');
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->total->getAmount()->toString())->toBe($v['total'])
            ->and($q->deposit->getAmount()->toString())->toBe($v['deposit'])
            ->and($q->rooms)->toBe(0)
            ->and(collect($q->lines)->whereIn('kind', ['lodging', 'addon']))->toBeEmpty();
    });

    it('en Professional el mismo tenant recupera el efecto (configuración conservada)', function () {
        [$engine, $p] = engineFromSeeds(plan: 'Professional');
        $q = $engine->quote($p, QuoteSelection::fromArray(prd011Selection()));

        expect($q->total->getAmount()->toString())->toBe(PRD011_EXPECTED_PEN['total']);
    });
});

describe('Disponibilidad por rangos y reglas de pasajeros', function () {
    it('dayStatus con 2 asientos', function (string $date, string $status, int $left) {
        [$engine, $p] = engineFromSeeds();
        $s = $engine->dayStatus($p, $date, seats: 2);

        expect($s->status)->toBe($status)->and($s->left)->toBe($left);
    })->with(collect(PRD011_DAYS_2_SEATS)->map(fn ($v, $d) => [$d, $v[0], $v[1]])->all());

    it('el 10/10 no alcanza para 4 asientos (sin_cupo, quedan 3)', function () {
        [$engine, $p] = engineFromSeeds();
        $s = $engine->dayStatus($p, '2026-10-10', seats: 4);

        expect($s->status)->toBe('sin_cupo')->and($s->left)->toBe(3);
    });

    it('rechaza composiciones inválidas con el mismo mensaje del prototipo', function (array $pax, string $error) {
        [$engine, $p] = engineFromSeeds();
        $v = $engine->validatePax($p, $pax);

        expect($v->ok)->toBeFalse()->and($v->errors)->toContain($error);
    })->with(PRD011_PAX_INVALID);

    it('clasifica edades: 3 INF, 4 CHD, 10 CHD, 11 ADT', function () {
        [$engine, $p] = engineFromSeeds();

        expect([3, 4, 10, 11])->sequence(
            fn ($a) => expect($engine->ageType($p, $a->value))->toBe('INF'),
            fn ($a) => expect($engine->ageType($p, $a->value))->toBe('CHD'),
            fn ($a) => expect($engine->ageType($p, $a->value))->toBe('CHD'),
            fn ($a) => expect($engine->ageType($p, $a->value))->toBe('ADT'),
        );
    });
});
