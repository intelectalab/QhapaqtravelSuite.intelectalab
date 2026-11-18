<?php

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\SalesAssistant;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Integrations\Mail\AgencyMailer;
use App\Domain\Integrations\Mail\RoutedMessagingChannel;
use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Landing\Contracts\RucLookup;
use App\Domain\Platform\Support\FxProviderCatalog;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Jobs\SendInvoiceToFiscalProvider;
use App\Jobs\SendPlainMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function idpEnforceReal(): void
{
    config(['integrations.require_real' => true]);
}

function idpMailboxBody(array $overrides = []): array
{
    return ['provider' => 'gmail', 'address' => 'Reservas@AndesTravel.pe', 'password' => 'abcd efgh ijkl mnop', 'from_name' => 'Andes Travel', ...$overrides];
}

function idpFakeSmtp(?string $problem = null): void
{
    test()->mock(SmtpConnector::class, fn ($mock) => $mock->shouldReceive('problem')->andReturn($problem)->shouldReceive('explain')->andReturn('No pudimos conectarnos.'));
    test()->mock(AgencyMailer::class, fn ($mock) => $mock->shouldReceive('deliver')->andReturn('<id@test>'));
}

it('en desarrollo todo funciona con los fakes y la agencia ve lo que le falta configurar', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/integrations/readiness')->assertOk()->json('data');

    expect($data['enforced'])->toBeFalse()
        ->and(array_column($data['items'], 'key'))->toBe(['email', 'whatsapp', 'ose', 'payments'])
        ->and(collect($data['items'])->firstWhere('key', 'email'))->toMatchArray(['status' => 'sin_configurar', 'usable' => true, 'detail' => 'Conecta tu correo para enviar.'])
        ->and($data['pending'])->toBeGreaterThanOrEqual(1)
        ->and(collect($data['features'])->every(fn (array $feature) => $feature['available']))->toBeTrue()
        ->and($data['can_manage'])->toBeTrue();
});

it('en producción las funciones de KipuControl sin proveedor real dicen «Próximamente» en lugar de inventar', function () {
    idpEnforceReal();
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/integrations/readiness')->assertOk()->json('data');

    expect($data['enforced'])->toBeTrue()
        ->and($data['features']['sales_ai'])->toMatchArray(['available' => false, 'message' => 'El asistente de ventas con IA estará disponible próximamente.'])
        ->and($data['features']['ruc']['available'])->toBeFalse()
        ->and(collect($data['items'])->firstWhere('key', 'email')['usable'])->toBeFalse();

    expect(fn () => app(RucLookup::class)->find('20601234567'))->toThrow(ApiException::class, 'La consulta del RUC en SUNAT estará disponible próximamente.')
        ->and(fn () => app(SalesAssistant::class)->complete('respuesta', 'Hola', []))->toThrow(ApiException::class)
        ->and(fn () => app(FxRateProvider::class)->latest(['USD'], now()->toDateString()))->toThrow(ApiException::class);

    $whatsapp = app(MessagingChannel::class)->send(new OutboundMessage('whatsapp', '+51987654321', null, 'Hola'));
    expect($whatsapp->ok)->toBeFalse()->and($whatsapp->message)->toBe('Conecta tu número de WhatsApp para enviar.');
});

it('con un proveedor real configurado la función queda disponible aun en producción', function () {
    idpEnforceReal();
    config(['integrations.drivers.sales_ai' => 'openai']);

    expect(IntegrationReadiness::usable('sales_ai'))->toBeTrue()
        ->and(IntegrationReadiness::usable('site_content_ai'))->toBeFalse();
});

it('en producción no se envía la cotización por correo sin el correo de la agencia', function () {
    idpEnforceReal();
    actingAsSeed('U02');
    decideInternally('COT-2026-00189', 'approve')->assertSuccessful();

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/send', sendBody(), critical((int) rowOf('quote_quotes', 'COT-2026-00189')->lock_version)))
        ->toBeApiError(409, IntegrationReadiness::CODE);

    expect(rowOf('quote_quotes', 'COT-2026-00189')->status)->not->toBe('enviada');
});

it('en producción no se emite un comprobante sin OSE conectado', function () {
    idpEnforceReal();
    actingAsSeed('U07');

    $response = $this->postJson('/api/v1/finance/invoices', ['receivable_id' => 'CXC-00715', 'doc_type' => '03', 'customer_doc_type' => 'DNI', 'customer_doc_number' => '41220988', 'customer_name' => 'Familia Castañeda Ugarte', 'domiciled' => true, 'amount' => '1896.66', 'description' => 'Servicios turísticos'], critical());

    expect($response)->toBeApiError(409, IntegrationReadiness::CODE);
});

it('en producción una agencia en prueba emite con el OSE simulado y se le avisa que no vale ante SUNAT', function () {
    idpEnforceReal();
    DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->update(['status' => 'prueba']);
    actingAsSeed('U07');

    $ose = collect($this->getJson('/api/v1/integrations/readiness')->json('data.items'))->firstWhere('key', 'ose');
    expect($ose['status'])->not->toBe('conectado')
        ->and($ose['usable'])->toBeTrue()
        ->and($ose['detail'])->toContain('sin validez ante SUNAT');

    $data = $this->postJson('/api/v1/finance/invoices', ['receivable_id' => 'CXC-00715', 'doc_type' => '03', 'customer_doc_type' => 'DNI', 'customer_doc_number' => '41220988', 'customer_name' => 'Familia Castañeda Ugarte', 'domiciled' => true, 'amount' => '1896.66', 'description' => 'Servicios turísticos'], critical())->assertStatus(202)->json('data');

    $invoice = rowOf('fin_invoices', $data['number'], column: 'number');
    withinTenant(tenantA(), fn () => app()->call([new SendInvoiceToFiscalProvider((string) $invoice->id), 'handle']));

    expect(rowOf('fin_invoices', $data['number'], column: 'number'))->fiscal_provider->toBe('OSE (simulado)')->status->toBe('aceptado')
        ->and(IntegrationReadiness::simulationAllowed('sales_ai'))->toBeFalse();
});

it('el tipo de cambio «Simulado» sigue existiendo, pero no viene validado en producción', function () {
    $simulated = fn () => collect(app(FxProviderCatalog::class)->all())->firstWhere('driver', 'simulado');

    expect($simulated()['status'])->toBe('validado');

    idpEnforceReal();

    expect($simulated())->not->toBeNull()->and($simulated()['status'])->toBe('por_validar');
});

it('la agencia conecta su propio correo con la clave de aplicación y nunca se devuelve la clave', function () {
    idpFakeSmtp();
    actingAsSeed('U01');

    $data = $this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody())->assertOk()->json('data');

    expect($data)->toMatchArray(['status' => 'conectado', 'provider' => 'gmail', 'address' => 'reservas@andestravel.pe', 'password_set' => true, 'host' => null])
        ->and(json_encode($data))->not->toContain('abcd efgh');

    $stored = withinTenant(tenantA(), fn () => app(AgencyMailbox::class)->connection());
    expect($stored)->toMatchArray(['host' => 'smtp.gmail.com', 'port' => 465, 'encryption' => 'ssl', 'username' => 'reservas@andestravel.pe']);

    expect(collect($this->getJson('/api/v1/integrations/readiness')->json('data.items'))->firstWhere('key', 'email')['status'])->toBe('conectado');

    $audit = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', 'correo-de-salida')->where('action', 'conectar')->first());
    expect($audit)->not->toBeNull()->and((string) $audit->after_value)->not->toContain('abcd');

    $this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody(['password' => null, 'from_name' => 'Reservas Andes']))->assertOk()->assertJsonPath('data.from_name', 'Reservas Andes');

    $this->deleteJson('/api/v1/settings/outgoing-mail')->assertOk()->assertJsonPath('data.status', 'sin_configurar');
    expect($this->deleteJson('/api/v1/settings/outgoing-mail'))->toBeApiError(422, 'CFG-BR-01');
});

it('si la prueba de conexión falla no se guarda el correo', function () {
    idpFakeSmtp('El servidor de correo rechazó el usuario o la contraseña.');
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody()))->toBeApiError(422, 'MAIL-TEST-FAILED');
    $this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody(['provider' => 'otro']))->assertStatus(422);
    $this->getJson('/api/v1/settings/outgoing-mail')->assertOk()->assertJsonPath('data.status', 'sin_configurar');
});

it('otro servidor exige servidor, puerto y cifrado', function () {
    idpFakeSmtp();
    actingAsSeed('U01');

    $this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody(['provider' => 'otro', 'host' => 'mail.andestravel.pe', 'port' => 587, 'encryption' => 'tls']))
        ->assertOk()->assertJsonPath('data.host', 'mail.andestravel.pe')->assertJsonPath('data.port', 587);
});

it('solo el administrador configura el correo de salida', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/settings/outgoing-mail')->assertStatus(403);
    $this->getJson('/api/v1/integrations/readiness')->assertOk()->assertJsonPath('data.can_manage', false);
});

it('los correos de la agencia salen de su cuenta y, en producción sin cuenta, no se simulan', function () {
    Queue::fake();
    actingAsSeed('U01');

    expect(withinTenant(tenantA(), fn () => app(QueuedMail::class)->sendAsAgency('cliente@example.com', null, 'Hola', 'Cuerpo')))->toBeTrue();
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $job) => $job->sender === null);

    idpEnforceReal();
    expect(withinTenant(tenantA(), fn () => app(QueuedMail::class)->sendAsAgency('cliente@example.com', null, 'Hola', 'Cuerpo')))->toBeFalse();
    Queue::assertPushed(SendPlainMail::class, 1);

    idpFakeSmtp();
    $this->putJson('/api/v1/settings/outgoing-mail', idpMailboxBody())->assertOk();
    expect(withinTenant(tenantA(), fn () => app(QueuedMail::class)->sendAsAgency('cliente@example.com', null, 'Hola', 'Cuerpo')))->toBeTrue();
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $job) => ($job->sender['from_address'] ?? null) === 'reservas@andestravel.pe');
});

it('los mensajes por correo del motor de avisos usan el correo de la agencia', function () {
    $fake = new FakeMessagingChannel;
    $mailer = Mockery::mock(AgencyMailer::class);
    $mailbox = Mockery::mock(AgencyMailbox::class);
    $channel = new RoutedMessagingChannel($fake, $mailbox, $mailer, new SmtpConnector);

    $mailbox->shouldReceive('connection')->andReturn(null, ['host' => 'smtp.gmail.com', 'port' => 465, 'encryption' => 'ssl', 'username' => 'a@b.pe', 'password' => 'x', 'from_address' => 'a@b.pe', 'from_name' => '']);
    $mailer->shouldReceive('deliver')->once()->andReturn('<m@b.pe>');

    expect($channel->send(new OutboundMessage('email', 'cliente@example.com', 'Hola', 'Cuerpo'))->ok)->toBeTrue()
        ->and($fake->sent)->toHaveCount(1);

    $sent = $channel->send(new OutboundMessage('email', 'cliente@example.com', 'Hola', 'Cuerpo'));
    expect($sent->ok)->toBeTrue()->and($sent->externalId)->toBe('<m@b.pe>')->and($fake->sent)->toHaveCount(1);

    $channel->send(new OutboundMessage('whatsapp', '+51987654321', null, 'Hola'));
    expect($fake->sent)->toHaveCount(2);
});

it('la página de planes no consulta el tipo de cambio ni el RUC simulados en producción', function () {
    idpEnforceReal();

    $data = $this->getJson('/api/v1/public/plans')->assertOk()->json('data');

    expect($data['fx'])->toBeNull()
        ->and($data['ruc_lookup'])->toBeFalse()
        ->and($data['online_payment'])->toBeFalse();
});

it('sin consulta del RUC la agencia se inscribe declarando su razón social y domicilio fiscal', function () {
    require_once __DIR__.'/../Fase3/Seguimiento/SeguimientoHelpers.php';
    segCleanSlate();
    idpEnforceReal();
    $body = ['plan' => 'starter', 'cycle' => 'prueba', 'admin_name' => 'Lucía Quispe', 'email' => 'lucia@andesnuevos.pe', 'password' => 'Machu-Picchu-2026', 'commercial_name' => 'Andes Nuevos', 'ruc' => segRuc('2060777111'), 'city' => 'Cusco', 'business_type' => 'Operador turístico', 'doc_type' => 'factura', 'accept_terms' => true, 'terms_version' => 'TYC-2026.1'];

    expect($this->postJson('/api/v1/public/signups', $body, critical()))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->postJson('/api/v1/public/signups', [...$body, 'ruc' => '20601234560', 'legal_name' => 'Andes Nuevos S.A.C.', 'fiscal_address' => 'Av. El Sol 120, Cusco'], critical())->assertStatus(422);

    $this->postJson('/api/v1/public/signups', [...$body, 'legal_name' => 'Andes Nuevos S.A.C.', 'fiscal_address' => 'Av. El Sol 120, Cusco'], critical())->assertCreated();

    expect(DB::connection('pgsql_platform')->table('tenants')->where('ruc', segRuc('2060777111'))->value('legal_name'))->toBe('Andes Nuevos S.A.C.');
});
