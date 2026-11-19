<?php

use App\Domain\B2bPortal\Support\B2bAccount;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function b2bAlertAgency(array $values): void
{
    $agencyId = (string) seedUser('U13')->agency_id;
    withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('id', $agencyId)->update([...$values, 'valid_to' => '2027-12-31']));
}

function b2bCreditAlert(): ?array
{
    return collect(test()->getJson('/api/v1/b2b/home')->assertOk()->json('data.alerts'))->firstWhere('kind', 'credit');
}

it('B2B: el portal avisa cuando la agencia usa el 80 % o más de su línea de crédito', function () {
    actingAsSeed('U13');

    b2bAlertAgency(['status' => 'activa', 'block_reason' => null, 'credit_limit' => '10000.00', 'credit_used' => '8500.00']);
    $alert = b2bCreditAlert();

    expect(B2bAccount::CREDIT_ALERT_PCT)->toBe(80)
        ->and($alert)->not->toBeNull()
        ->and($alert['tone'])->toBe('warn')
        ->and($alert['detail'])->toContain('85 %')
        ->and((float) $alert['amount'])->toBe(1500.0)
        ->and($alert['href'])->toBe('/agencia/cuenta');

    b2bAlertAgency(['credit_used' => '8000.00']);
    expect(b2bCreditAlert())->not->toBeNull();

    b2bAlertAgency(['credit_used' => '7999.00']);
    expect(b2bCreditAlert())->toBeNull();
});

it('B2B: sin línea de crédito o con la línea bloqueada no sale la alerta del 80 %', function () {
    actingAsSeed('U13');

    b2bAlertAgency(['status' => 'activa', 'block_reason' => null, 'credit_limit' => '0.00', 'credit_used' => '0.00']);
    expect(b2bCreditAlert())->toBeNull();

    b2bAlertAgency(['status' => 'bloqueada', 'block_reason' => 'credito_excedido', 'credit_limit' => '10000.00', 'credit_used' => '10500.00']);
    $alerts = collect($this->getJson('/api/v1/b2b/home')->assertOk()->json('data.alerts'));

    expect($alerts->firstWhere('kind', 'credit'))->toBeNull()
        ->and($alerts->firstWhere('kind', 'block')['title'])->toBe('Línea de crédito bloqueada');
});
