<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Booking\Support\LineRates;
use Illuminate\Support\Facades\DB;

function humantayWebDate(): string
{
    for ($offset = 2; $offset < 30; $offset++) {
        $date = date('Y-m-d', strtotime(BUSINESS_TODAY." +{$offset} days"));

        if (test()->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->status() === 200) {
            return $date;
        }
    }

    throw new RuntimeException('Humantay no tiene una fecha vendible en el mes de prueba.');
}

it('el sitio y el motor cotizan el mismo precio con la tarifa web (E-commerce) de la agencia', function () {
    $date = humantayWebDate();

    $site = $this->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data');
    $engine = $this->postJson('/api/v1/public/quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'pax' => ['adt' => 2]], siteOf())->assertOk()->json('data');

    expect($site['lines'][0]['unit'])->toBe('129.00')
        ->and($engine['total'])->toBe($site['total']);
});

it('el visitante no puede pedir desde el navegador el precio de otro canal', function () {
    $date = humantayWebDate();

    $web = $this->postJson('/api/v1/public/quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'pax' => ['adt' => 2]], siteOf())->assertOk()->json('data.total');
    $asAgency = $this->postJson('/api/v1/public/quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'pax' => ['adt' => 2], 'channel' => 'B2B'], siteOf())->assertOk()->json('data.total');

    expect($asAgency)->toBe($web)->not->toBe('240.00');
});

it('CAT-BR-18: con temporadas cruzadas gana la de menor número de prioridad, y R-SEASON apagada no aplica recargo', function () {
    $season = fn (): ?string => withinTenant(tenantA(), fn () => app(LineRates::class)->seasonFactor('2026-07-28'));

    expect($season())->toBe('1.35');

    withinTenant(tenantA(), function () {
        DB::table('sys_booking_rules')->where('code', 'R-SEASON')->update(['enabled' => false]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });

    expect($season())->toBeNull();
});
