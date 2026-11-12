<?php

use App\Http\Middleware\EnsureChannelEnabled;
use Illuminate\Support\Facades\DB;

function setChannel(string $key, bool $on): void
{
    withinTenant(tenantA(), function () use ($key, $on): void {
        $values = (array) json_decode((string) DB::table('sys_settings')->where('section', 'channels')->value('values'), true);
        DB::table('sys_settings')->where('section', 'channels')->update(['values' => json_encode([...$values, $key => $on])]);
    });
}

it('apagar el sitio web bloquea sus rutas públicas al instante (CFG-BR-12)', function () {
    $this->getJson('/api/v1/public/site', siteOf())->assertOk();

    setChannel('web', false);

    expect($this->getJson('/api/v1/public/site', siteOf()))->toBeApiError(403, 'CHANNEL_DISABLED');
});

it('cada familia de rutas se asocia a su canal', function () {
    expect(EnsureChannelEnabled::channelFor('mobile.operator.today'))->toBe('app_operador')
        ->and(EnsureChannelEnabled::channelFor('portal.passenger.trip'))->toBe('portal_pasajero')
        ->and(EnsureChannelEnabled::channelFor('portal.quotes.index'))->toBe('portal_cliente')
        ->and(EnsureChannelEnabled::channelFor('public.site.cart.add'))->toBe('ecommerce')
        ->and(EnsureChannelEnabled::channelFor('crm.leads.index'))->toBeNull();
});
