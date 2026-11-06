<?php

use Illuminate\Support\Facades\DB;

it('la base de pruebas tiene la semilla del kit con la fecha de negocio sin desplazar', function () {
    expect(tenantA()->status)->toBe('activo')
        ->and(tenantB()->code)->toBe('TNT-0002')
        ->and(seedUser('U03')->email)->toBe('lparedes@andeshorizonte.pe')
        ->and(seedUser('U01', tenantB())->tenant_id)->toBe(tenantB()->getKey())
        ->and(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('enviada')
        ->and((string) rowOf('quote_quotes', 'COT-2026-00189')->valid_until)->toStartWith('2026-10-12');
});

it('cada prueba corre en una transacción que se revierte', function () {
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00189')->update(['title' => 'Cambio que no debe persistir']));

    expect(rowOf('quote_quotes', 'COT-2026-00189')->title)->toBe('Cambio que no debe persistir');
});

it('el cambio de la prueba anterior no persiste', function () {
    expect(rowOf('quote_quotes', 'COT-2026-00189')->title)->not->toBe('Cambio que no debe persistir');
});
