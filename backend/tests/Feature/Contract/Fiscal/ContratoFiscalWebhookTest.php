<?php

use App\Domain\Integrations\Fake\FakeFiscalGateway;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use App\Domain\Platform\Support\OseCatalog;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

const FISCAL_OSE_KEY = 'clave-del-ose-de-pruebas';

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    app(OseCatalog::class)->save([['code' => 'OSE-PRUEBA', 'name' => 'OSE de pruebas', 'driver' => 'rest', 'status' => 'homologado'], ['code' => 'OSE-OTRO', 'name' => 'Otro OSE', 'driver' => 'rest', 'status' => 'homologado']], null);
    app(FiscalWebhookSecret::class)->store('OSE-PRUEBA', FISCAL_OSE_KEY, null);
});

function fiscalWebhook(array $event, ?string $signature = null, string $provider = 'ose-prueba'): TestResponse
{
    $raw = (string) json_encode($event);

    return test()->call('POST', "/api/v1/integrations/fiscal/{$provider}/webhook", [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_FISCAL_SIGNATURE' => $signature ?? FakeFiscalGateway::sign($raw, FISCAL_OSE_KEY)], $raw);
}

function ticketedInvoice(?string $status = 'emitido'): object
{
    return withinTenant(tenantA(), function () use ($status): object {
        $invoice = DB::table('fin_invoices')->whereNotNull('ose_ticket')->where('status', 'aceptado')->orderBy('number')->first();

        if ($status !== null) {
            DB::table('fin_invoices')->where('id', $invoice->id)->update(['status' => $status]);
        }

        return DB::table('fin_invoices')->where('id', $invoice->id)->first();
    });
}

it('integrationsFiscalWebhook aplica la respuesta del OSE al comprobante del ticket, la audita y marca como duplicado el reenvío', function () {
    $invoice = ticketedInvoice();
    $event = ['ticket' => $invoice->ose_ticket, 'status' => 'observado', 'code' => '4252', 'message' => 'El dato ingresado como dirección no cumple el formato.', 'tenant_id' => (string) tenantA()->getKey()];

    fiscalWebhook($event)->assertOk()->assertJsonPath('data.result', 'aplicado')->assertJsonPath('data.status', 'observado')->assertJsonPath('data.number', $invoice->number);
    fiscalWebhook($event)->assertOk()->assertJsonPath('data.result', 'duplicado');

    $after = rowOf('fin_invoices', $invoice->number, column: 'number');
    $events = withinTenant(tenantA(), fn () => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('request_hash', hash('sha256', "webhook|{$invoice->ose_ticket}|observado"))->get());

    expect($after->status)->toBe('observado')
        ->and($after->ose_response_code)->toBe('4252')
        ->and($after->ose_response_message)->toBe('El dato ingresado como dirección no cumple el formato.')
        ->and($after->lock_version)->toBe($invoice->lock_version + 1)
        ->and($events)->toHaveCount(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Comprobante', 'entity_id' => $invoice->number, 'action' => 'respuesta_ose', 'before_value' => 'emitido', 'after_value' => 'observado'])->whereNull('actor_id')->exists()))->toBeTrue();
});

it('integrationsFiscalWebhook resuelve la agencia desde el comprobante cuando el payload no la trae', function () {
    $invoice = ticketedInvoice();

    fiscalWebhook(['ticket' => $invoice->ose_ticket, 'status' => 'aceptado'])->assertOk()->assertJsonPath('data.result', 'aplicado');

    expect(rowOf('fin_invoices', $invoice->number, column: 'number')->status)->toBe('aceptado');
});

it('integrationsFiscalWebhook no reaplica otra respuesta a un comprobante que ya la tiene', function () {
    $invoice = ticketedInvoice(null);

    fiscalWebhook(['ticket' => $invoice->ose_ticket, 'status' => 'aceptado'])->assertOk()->assertJsonPath('data.result', 'duplicado');
    expect(fiscalWebhook(['ticket' => $invoice->ose_ticket, 'status' => 'rechazado']))->toBeApiError(409, 'FIN-BR-49');
    expect(rowOf('fin_invoices', $invoice->number, column: 'number')->status)->toBe('aceptado');
});

it('integrationsFiscalWebhook rechaza firma inválida, proveedor ajeno, ticket desconocido y agencia que no coincide', function () {
    $invoice = ticketedInvoice();
    $event = ['ticket' => $invoice->ose_ticket, 'status' => 'aceptado'];

    fiscalWebhook($event, 'firma-falsa')->assertUnauthorized();
    fiscalWebhook($event, provider: 'no-existe')->assertNotFound();
    fiscalWebhook(['ticket' => 'TICKET-INEXISTENTE', 'status' => 'aceptado'])->assertNotFound();
    fiscalWebhook(['ticket' => $invoice->ose_ticket, 'status' => 'pendiente'])->assertUnprocessable();
    expect(fiscalWebhook([...$event, 'tenant_id' => (string) tenantB()->getKey()]))->toBeApiError(422, 'FIN-WEBHOOK-TENANT');

    expect(rowOf('fin_invoices', $invoice->number, column: 'number')->status)->toBe('emitido');
});

it('integrationsFiscalWebhook valida con la clave de ese OSE: otro OSE sin clave o con la suya no sirve', function () {
    $invoice = ticketedInvoice();
    $event = ['ticket' => $invoice->ose_ticket, 'status' => 'aceptado'];
    $raw = (string) json_encode($event);

    expect(fiscalWebhook($event, provider: 'ose-otro'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID')
        ->and(fiscalWebhook($event, provider: 'ose-otro')->json('message'))->toContain('Falta generar la clave de firma de Otro OSE');

    app(FiscalWebhookSecret::class)->store('OSE-OTRO', 'clave-del-otro-ose', null);
    fiscalWebhook($event, FakeFiscalGateway::sign($raw, 'clave-del-otro-ose'))->assertUnauthorized();
    fiscalWebhook($event, provider: 'ose-otro')->assertUnauthorized();
    fiscalWebhook($event, FakeFiscalGateway::sign($raw, 'clave-del-otro-ose'), 'OSE-OTRO')->assertOk()->assertJsonPath('data.result', 'aplicado');
});

it('integrationsFiscalWebhook acepta la clave anterior durante 24 horas después de rotarla', function () {
    $invoice = ticketedInvoice();
    $event = ['ticket' => $invoice->ose_ticket, 'status' => 'observado', 'code' => '4252'];
    $raw = (string) json_encode($event);
    $keys = app(FiscalWebhookSecret::class);

    expect($keys->store('OSE-PRUEBA', 'clave-nueva-del-ose', null))->toBeTrue()
        ->and($keys->summary('OSE-PRUEBA')['still_previous'])->toBeTrue();

    fiscalWebhook($event)->assertOk()->assertJsonPath('data.result', 'aplicado');
    expect($keys->summary('OSE-PRUEBA'))->toMatchArray(['still_previous' => true, 'last_key' => 'anterior', 'previous_secret_valid' => true]);

    $this->travel(25)->hours();
    fiscalWebhook($event)->assertUnauthorized();
    fiscalWebhook($event, FakeFiscalGateway::sign($raw, 'clave-nueva-del-ose'))->assertOk()->assertJsonPath('data.result', 'duplicado');
    expect($keys->summary('OSE-PRUEBA'))->toMatchArray(['still_previous' => false, 'last_key' => 'actual', 'previous_secret_valid' => false]);
});
