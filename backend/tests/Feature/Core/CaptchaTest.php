<?php

use App\Domain\Integrations\Adapters\TurnstileClient;
use App\Domain\Integrations\Fake\FakeCaptchaVerifier;
use App\Domain\Platform\Support\FormProtection;
use App\Http\Middleware\VerifyCaptcha;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function captchaDemo(?string $token = null): TestResponse
{
    return test()->postJson('/api/v1/public/software/demo-requests', ['full_name' => 'Ana Prueba', 'email' => 'ana.prueba@ejemplo.test', 'consent' => true], $token === null ? [] : [VerifyCaptcha::HEADER => $token]);
}

function captchaStored(): array
{
    return (array) json_decode((string) DB::connection('pgsql_platform')->table('platform_settings')->where('key', FormProtection::KEY)->value('value'), true);
}

function turnstileAnswers(array ...$answers): void
{
    $sequence = Http::sequence();
    foreach ($answers as $answer) {
        $sequence->push($answer, isset($answer['success']) && $answer['success'] === false && in_array('invalid-input-secret', $answer['error-codes'] ?? [], true) ? 400 : 200);
    }
    Http::fake([TurnstileClient::ENDPOINT => $sequence]);
}

it('los formularios públicos, el pedido de demo y el checkout pasan por el CAPTCHA', function () {
    $routes = collect(app('router')->getRoutes()->getRoutes())->filter(fn ($route) => in_array($route->getName(), ['public.site.forms.leads', 'public.site.forms.contact', 'public.site.forms.newsletter', 'public.site.forms.claims', 'public.software.demo-requests.store', 'public.site.cart.checkout'], true));

    expect($routes)->toHaveCount(6)
        ->and($routes->every(fn ($route) => in_array('captcha', $route->gatherMiddleware(), true)))->toBeTrue();
});

it('sin configurar en la consola, la web no recibe clave y los formularios funcionan sin CAPTCHA', function () {
    $this->getJson('/api/v1/public/captcha')->assertOk()->assertJsonPath('data.site_key', null)->assertJsonPath('data.provider', null);

    expect(captchaDemo(FakeCaptchaVerifier::FAILING_TOKEN))->toBeApiError(422, 'CAPTCHA_FAILED');
});

it('el Super Admin configura Turnstile: la clave se prueba, se guarda cifrada, no se devuelve y queda en la auditoría', function () {
    actingAsPlatform();
    turnstileAnswers(['success' => false, 'error-codes' => ['invalid-input-response']]);

    $summary = $this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => true, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => '0x4AAAAAAASecretoDePrueba1234'])->assertOk()->json('data');

    expect($summary['status'])->toBe('activa')
        ->and($summary['secret_hint'])->toBe('••••1234')
        ->and(json_encode($summary))->not->toContain('SecretoDePrueba')
        ->and(captchaStored()['secret'])->not->toContain('SecretoDePrueba')
        ->and(app(FormProtection::class)->secret())->toBe('0x4AAAAAAASecretoDePrueba1234')
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Clave secreta de Turnstile')->value('after_value'))->toBe('cambiada');

    $this->getJson('/api/v1/platform/settings')->assertOk()->assertJsonPath('data.sections.form_protection.site_key', '0x4AAAAAAAPrueba')->assertJsonMissingPath('data.sections.form_protection.secret');
    $this->getJson('/api/v1/public/captcha')->assertOk()->assertJsonPath('data.site_key', '0x4AAAAAAAPrueba')->assertJsonPath('data.provider', 'turnstile');
});

it('con Turnstile activo, cada envío se valida con Cloudflare usando la clave guardada', function () {
    app(FormProtection::class)->store(true, '0x4AAAAAAAPrueba', '0x4AAAAAAASecretoDePrueba1234', now()->toIso8601String(), (string) platformUser()->getKey());
    turnstileAnswers(['success' => false, 'error-codes' => ['invalid-input-response']], ['success' => true]);

    expect(captchaDemo('token-falso'))->toBeApiError(422, 'CAPTCHA_FAILED');
    expect(captchaDemo('token-de-cloudflare')->json('code'))->not->toBe('CAPTCHA_FAILED');

    Http::assertSent(fn ($request) => $request['secret'] === '0x4AAAAAAASecretoDePrueba1234' && $request['response'] === 'token-de-cloudflare');
});

it('rechaza una clave secreta que Cloudflare no reconoce y no guarda nada', function () {
    actingAsPlatform();
    turnstileAnswers(['success' => false, 'error-codes' => ['invalid-input-secret']]);

    expect($this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => true, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => 'claveEquivocada']))->toBeApiError(422, 'CFG-CAPTCHA-02')
        ->and(captchaStored())->toBe([]);
});

it('no se activa sin las dos claves, y dejar la secreta vacía conserva la guardada', function () {
    actingAsPlatform();
    Http::fake([TurnstileClient::ENDPOINT => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']])]);

    expect($this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => true, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => '']))->toBeApiError(422, 'CFG-CAPTCHA-01');

    $this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => true, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => '0x4AAAAAAASecretoDePrueba1234'])->assertOk();
    $this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => false, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => ''])->assertOk()->assertJsonPath('data.status', 'apagada');

    expect(app(FormProtection::class)->secret())->toBe('0x4AAAAAAASecretoDePrueba1234')
        ->and($this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => false, 'site_key' => '0x4AAAAAAAPrueba', 'secret' => '']))->toBeApiError(422, 'CFG-BR-01');
    $this->getJson('/api/v1/public/captcha')->assertJsonPath('data.site_key', null);
});

it('una agencia no puede tocar la protección de formularios', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/platform/settings/form-protection', ['enabled' => false, 'site_key' => '', 'secret' => ''])->assertStatus(403);
});

it('el cliente de Turnstile no llama afuera sin clave o sin token', function () {
    Http::fake();
    $turnstile = new TurnstileClient;

    expect($turnstile->verify('', 'token'))->toBeFalse()
        ->and($turnstile->verify('clave', null))->toBeFalse()
        ->and($turnstile->verify('clave', '   '))->toBeFalse();
    Http::assertNothingSent();
});
