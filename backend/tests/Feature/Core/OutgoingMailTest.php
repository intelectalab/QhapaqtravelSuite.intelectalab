<?php

use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Transport\TransportInterface;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function fakeSmtp(?string $problem = null, bool $failSend = false): object
{
    $fake = new class extends SmtpConnector
    {
        public ArrayTransport $sent;

        public ?string $answer = null;

        public bool $failSend = false;

        public array $probed = [];

        public function make(array $connection): TransportInterface
        {
            if ($this->failSend) {
                throw new TransportException('Expected response code "235" but got code "535", with message "535 Incorrect authentication data".');
            }

            return $this->sent;
        }

        public function problem(array $connection): ?string
        {
            $this->probed[] = $connection;

            return $this->answer;
        }
    };
    $fake->sent = new ArrayTransport;
    $fake->answer = $problem;
    $fake->failSend = $failSend;
    app()->instance(SmtpConnector::class, $fake);

    return $fake;
}

function outgoingMailStored(): array
{
    return (array) json_decode((string) DB::connection('pgsql_platform')->table('platform_settings')->where('key', OutgoingMail::KEY)->value('value'), true);
}

function outgoingMailPayload(array $overrides = []): array
{
    return [...['enabled' => true, 'host' => 'mail.ejemplo.test', 'port' => 465, 'encryption' => 'ssl', 'username' => 'avisos@ejemplo.test', 'password' => 'ClaveDelBuzon2026', 'from_address' => 'avisos@ejemplo.test', 'from_name' => 'Plataforma de prueba'], ...$overrides];
}

it('el Super Admin configura el correo de salida: se prueba la conexión, la contraseña se guarda cifrada, no se devuelve y queda en la auditoría', function () {
    actingAsPlatform();
    $smtp = fakeSmtp();

    $summary = $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload())->assertOk()->json('data');

    expect($summary['status'])->toBe('activa')
        ->and($summary['password_set'])->toBeTrue()
        ->and($summary['verified_at'])->not->toBeNull()
        ->and(json_encode($summary))->not->toContain('ClaveDelBuzon')
        ->and(outgoingMailStored()['password'])->not->toContain('ClaveDelBuzon')
        ->and(app(OutgoingMail::class)->password())->toBe('ClaveDelBuzon2026')
        ->and($smtp->probed)->toHaveCount(1)
        ->and($smtp->probed[0]['host'])->toBe('mail.ejemplo.test')
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Contraseña del correo')->value('after_value'))->toBe('cambiada')
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Servidor de salida')->value('after_value'))->toBe('mail.ejemplo.test');

    $this->getJson('/api/v1/platform/settings')->assertOk()->assertJsonPath('data.sections.outgoing_mail.host', 'mail.ejemplo.test')->assertJsonMissingPath('data.sections.outgoing_mail.password');
});

it('si el servidor rechaza la conexión no guarda nada y explica el motivo', function () {
    actingAsPlatform();
    fakeSmtp('El servidor de correo rechazó el usuario o la contraseña.');

    expect($this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload()))->toBeApiError(422, 'CFG-MAIL-02')
        ->and(outgoingMailStored())->toBe([]);
});

it('no se activa sin los datos completos, y dejar la contraseña vacía conserva la guardada', function () {
    actingAsPlatform();
    $smtp = fakeSmtp();

    expect($this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload(['password' => ''])))->toBeApiError(422, 'CFG-MAIL-01');

    $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload())->assertOk();
    $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload(['password' => '', 'from_name' => 'Avisos']))->assertOk()->assertJsonPath('data.from_name', 'Avisos');
    $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload(['password' => '', 'from_name' => 'Avisos', 'enabled' => false]))->assertOk()->assertJsonPath('data.status', 'apagada');

    expect(app(OutgoingMail::class)->password())->toBe('ClaveDelBuzon2026')
        ->and($smtp->probed)->toHaveCount(1)
        ->and($this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload(['password' => '', 'from_name' => 'Avisos', 'enabled' => false])))->toBeApiError(422, 'CFG-BR-01');
});

function activeOutgoingMail(): void
{
    app(OutgoingMail::class)->store(['enabled' => true, 'host' => 'mail.ejemplo.test', 'port' => 465, 'encryption' => 'ssl', 'username' => 'avisos@ejemplo.test', 'from_address' => 'avisos@ejemplo.test', 'from_name' => 'Plataforma de prueba'], 'ClaveDelBuzon2026', now()->toIso8601String(), (string) platformUser()->getKey());
}

it('en producción, con la cuenta activa, los correos salen por ella con su remitente al destinatario real', function () {
    $smtp = fakeSmtp();
    activeOutgoingMail();
    app()->detectEnvironment(fn () => 'production');
    config(['mail.mailers.platform.redirect_to' => 'desvio@ejemplo.test']);

    Mail::mailer('platform')->raw('Hola', fn ($message) => $message->to('cliente@ejemplo.test')->subject('Aviso'));

    $sent = $smtp->sent->messages()->first();
    expect($smtp->sent->messages())->toHaveCount(1)
        ->and($sent->getEnvelope()->getSender()->getAddress())->toBe('avisos@ejemplo.test')
        ->and($sent->getOriginalMessage()->getFrom()[0]->getName())->toBe('Plataforma de prueba')
        ->and(array_map(fn ($address) => $address->getAddress(), $sent->getEnvelope()->getRecipients()))->toBe(['cliente@ejemplo.test'])
        ->and($sent->getOriginalMessage()->getSubject())->toBe('Aviso')
        ->and(app(OutgoingMail::class)->summary()['redirect'])->toBeNull();
});

it('fuera de producción, con la cuenta activa, todo se desvía a la dirección de desarrollo y se ve a quién iba', function () {
    $smtp = fakeSmtp();
    activeOutgoingMail();
    config(['mail.mailers.platform.redirect_to' => ' Desvio@Ejemplo.test ']);

    Mail::mailer('platform')->raw('Hola', fn ($message) => $message->to('cliente@ejemplo.test')->cc('copia@ejemplo.test')->bcc('oculta@ejemplo.test')->subject('Aviso'));

    $sent = $smtp->sent->messages()->first();
    $original = $sent->getOriginalMessage();
    expect($smtp->sent->messages())->toHaveCount(1)
        ->and(array_map(fn ($address) => $address->getAddress(), $sent->getEnvelope()->getRecipients()))->toBe(['desvio@ejemplo.test'])
        ->and($original->getCc())->toBe([])
        ->and($original->getBcc())->toBe([])
        ->and($original->getSubject())->toBe('[Para cliente@ejemplo.test, copia@ejemplo.test, oculta@ejemplo.test] Aviso')
        ->and($original->getHeaders()->get('X-Original-To')->getBodyAsString())->toBe('cliente@ejemplo.test, copia@ejemplo.test, oculta@ejemplo.test')
        ->and(app(OutgoingMail::class)->summary()['redirect'])->toBe(['to' => 'desvio@ejemplo.test']);
});

it('fuera de producción y sin dirección de desvío, nada sale por la cuenta real: va al respaldo', function () {
    $smtp = fakeSmtp();
    activeOutgoingMail();
    config(['mail.mailers.platform.redirect_to' => 'no-es-correo', 'mail.mailers.platform.fallback' => 'array']);
    Mail::purge('platform');

    Mail::mailer('platform')->raw('Hola', fn ($message) => $message->to('cliente@ejemplo.test')->subject('Aviso'));

    expect($smtp->sent->messages())->toHaveCount(0)
        ->and(Mail::mailer('array')->getSymfonyTransport()->messages())->toHaveCount(1)
        ->and(app(OutgoingMail::class)->summary()['redirect'])->toBe(['to' => null]);
});

it('apagado o sin configurar, el correo se entrega al respaldo y no falla', function () {
    $smtp = fakeSmtp();
    config(['mail.mailers.platform.fallback' => 'array']);
    Mail::purge('platform');

    Mail::mailer('platform')->raw('Hola', fn ($message) => $message->to('cliente@ejemplo.test')->subject('Aviso'));

    expect($smtp->sent->messages())->toHaveCount(0)
        ->and(Mail::mailer('array')->getSymfonyTransport()->messages())->toHaveCount(1);
});

it('envía un correo de prueba y registra el resultado, también cuando falla', function () {
    actingAsPlatform();
    expect($this->postJson('/api/v1/platform/settings/outgoing-mail/test', ['to' => 'yo@ejemplo.test']))->toBeApiError(422, 'CFG-MAIL-03');

    $smtp = fakeSmtp();
    $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload())->assertOk();
    $this->postJson('/api/v1/platform/settings/outgoing-mail/test', ['to' => 'Yo@Ejemplo.test'])->assertOk()->assertJsonPath('data.last_test.ok', true)->assertJsonPath('data.last_test.to', 'yo@ejemplo.test');

    expect($smtp->sent->messages())->toHaveCount(1);

    fakeSmtp(failSend: true);
    expect($this->postJson('/api/v1/platform/settings/outgoing-mail/test', ['to' => 'yo@ejemplo.test']))->toBeApiError(422, 'CFG-MAIL-02')
        ->and(outgoingMailStored()['last_test']['ok'])->toBeFalse()
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Correo de prueba')->count())->toBe(2);
});

it('una agencia no puede tocar el correo de salida', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/platform/settings/outgoing-mail', outgoingMailPayload())->assertStatus(403);
    $this->postJson('/api/v1/platform/settings/outgoing-mail/test', ['to' => 'yo@ejemplo.test'])->assertStatus(403);
});
