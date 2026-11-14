<?php

use App\Domain\Platform\Support\OseCatalog;
use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function finanzasOseAudit(string $entityId, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', $entityId)->where('action', $action)->orderByDesc('code')->first();
}

function finanzasOseCatalog(): void
{
    actingAsPlatform();
    test()->postJson('/api/v1/platform/ose-providers', ['code' => 'OSE-REST', 'name' => 'OSE Uno', 'driver' => 'rest', 'status' => 'homologado'])->assertCreated();
    test()->postJson('/api/v1/platform/ose-providers', ['code' => 'OSE-DOS', 'name' => 'OSE Dos', 'driver' => 'sol'])->assertCreated();
}

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('la consola administra el catálogo de OSE con estado homologado y lo audita', function () {
    finanzasOseCatalog();

    $data = $this->getJson('/api/v1/platform/ose-providers')->assertOk()->json('data');
    expect(collect($data['providers'])->pluck('status', 'code')->all())->toBe(['OSE-REST' => 'homologado', 'OSE-DOS' => 'por_homologar'])
        ->and($data['counts']['homologated'])->toBe(1);

    $this->patchJson('/api/v1/platform/ose-providers/OSE-DOS', ['status' => 'homologado'])->assertOk()->assertJsonPath('data.status', 'homologado');
    expect(finanzasOseAudit('OSE · OSE-DOS', 'homologar')?->after_value)->toBe('estado: Homologado')
        ->and($this->patchJson('/api/v1/platform/ose-providers/OSE-DOS', ['status' => 'homologado']))->toBeApiError(422, 'CFG-BR-01');

    $this->deleteJson('/api/v1/platform/ose-providers/OSE-DOS')->assertOk();
    expect(collect($this->getJson('/api/v1/platform/ose-providers')->json('data.providers'))->pluck('code')->all())->toBe(['OSE-REST'])
        ->and(finanzasOseAudit('OSE · OSE-DOS', 'eliminar'))->not->toBeNull();
});

it('sin OSE elegido la agencia emite en modo simulado y solo elige entre los homologados', function () {
    finanzasOseCatalog();

    actingAsSeed('U07');
    $overview = $this->getJson('/api/v1/finance/ose')->assertOk()->json('data');
    expect($overview['mode'])->toBe('simulado')
        ->and($overview['step'])->toBe('sin_ose')
        ->and(collect($overview['options'])->pluck('code')->all())->toBe(['OSE-REST'])
        ->and($overview['can_choose'])->toBeFalse();
    $denied = $this->putJson('/api/v1/finance/ose', ['code' => 'OSE-REST']);
    expect($denied)->toBeApiError(403)->and($denied->json('required_permissions'))->toContain('admin.settings.manage');

    actingAsSeed('U01');
    expect($this->putJson('/api/v1/finance/ose', ['code' => 'OSE-DOS']))->toBeApiError(422, 'OSE-NOT-HOMOLOGATED');
    $chosen = $this->putJson('/api/v1/finance/ose', ['code' => 'OSE-REST'])->assertOk()->json('data');
    expect($chosen['provider']['code'])->toBe('OSE-REST')
        ->and($chosen['step'])->toBe('sin_credenciales')
        ->and($chosen['mode'])->toBe('simulado')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'OSE', 'entity_id' => 'OSE-REST', 'action' => 'elegir_ose'])->exists()))->toBeTrue();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/finance/ose'))->toBeApiError(403);
});

it('el Super Admin carga las credenciales cifradas en la ficha de la agencia, prueba la conexión y queda auditado', function () {
    finanzasOseCatalog();
    actingAsSeed('U01');
    $this->putJson('/api/v1/finance/ose', ['code' => 'OSE-REST'])->assertOk();

    actingAsPlatform();
    $tenant = tenantA();
    $ficha = $this->getJson("/api/v1/platform/tenants/{$tenant->code}/ose")->assertOk()->json('data');
    expect($ficha['provider']['code'])->toBe('OSE-REST')->and($ficha['credentials_complete'])->toBeFalse();

    $failed = $this->postJson("/api/v1/platform/tenants/{$tenant->code}/ose/test")->assertOk()->json('data');
    expect($failed['ok'])->toBeFalse()->and($failed['result'])->toContain('Faltan credenciales');

    $saved = $this->putJson("/api/v1/platform/tenants/{$tenant->code}/ose/credentials", ['credentials' => ['usuario' => 'andes-ose', 'clave' => 'clave-ose-2026', 'token' => 'tok-abcdef-998877']])->assertOk()->json('data');
    $raw = DB::connection('pgsql_platform')->table('platform_settings')->where('key', OseCatalog::TENANT_PREFIX.$tenant->getKey())->value('value');
    expect($saved['credentials_complete'])->toBeTrue()
        ->and(collect($saved['credentials'])->firstWhere('field', 'token')['hint'])->toEndWith('8877')
        ->and(json_encode($saved))->not->toContain('clave-ose-2026')
        ->and($raw)->not->toContain('clave-ose-2026')->not->toContain('tok-abcdef-998877')
        ->and(finanzasOseAudit("OSE · OSE-REST · {$tenant->code}", 'cargar_credenciales'))->not->toBeNull();

    $passed = $this->postJson("/api/v1/platform/tenants/{$tenant->code}/ose/test")->assertOk()->json('data');
    expect($passed['ok'])->toBeTrue()
        ->and(finanzasOseAudit("OSE · OSE-REST · {$tenant->code}", 'probar_conexion')?->after_value)->toStartWith('correcta');
    expect($this->deleteJson('/api/v1/platform/ose-providers/OSE-REST'))->toBeApiError(409, 'OSE-IN-USE');

    actingAsSeed('U07');
    $overview = $this->getJson('/api/v1/finance/ose')->assertOk()->json('data');
    expect($overview['ready'])->toBeTrue()
        ->and($overview['step'])->toBe('adaptador_pendiente')
        ->and($overview['mode'])->toBe('simulado')
        ->and(collect($overview['credentials'])->pluck('hint')->filter()->all())->toBe([]);

    actingAsPlatform();
    $this->deleteJson("/api/v1/platform/tenants/{$tenant->code}/ose/credentials")->assertOk()->assertJsonPath('data.credentials_complete', false);
    expect($this->deleteJson("/api/v1/platform/tenants/{$tenant->code}/ose/credentials"))->toBeApiError(422, 'CFG-BR-01');
});

it('el comprobante aceptado guarda su XML y su CDR en Documentos, visibles en la ficha y en el portal del cliente', function () {
    Queue::fake();
    Storage::fake(config('filesystems.default'));
    actingAsSeed('U07');

    $number = $this->postJson('/api/v1/finance/invoices', [
        'receivable_id' => 'CXC-00715',
        'doc_type' => '03',
        'customer_doc_type' => 'DNI',
        'customer_doc_number' => '41220988',
        'customer_name' => 'Familia Castañeda & Ugarte',
        'domiciled' => true,
        'amount' => '1896.66',
        'description' => 'Servicios turísticos: viaje familiar a Cusco',
    ], critical())->assertStatus(202)->json('data.number');
    $id = (string) rowOf('fin_invoices', $number, column: 'number')->id;
    withinTenant(tenantA(), fn () => app()->call([new SendInvoiceToFiscalProvider($id), 'handle']));

    $invoice = rowOf('fin_invoices', $number, column: 'number');
    $documents = withinTenant(tenantA(), fn () => DB::table('sys_documents')->whereIn('id', [$invoice->xml_document_id, $invoice->cdr_document_id])->get()->keyBy('doc_type'));
    $xml = (string) Storage::disk(config('filesystems.default'))->get($documents['invoice_xml']->storage_path);
    $cdr = (string) Storage::disk(config('filesystems.default'))->get($documents['invoice_cdr']->storage_path);

    expect($invoice->status)->toBe('aceptado')
        ->and($documents['invoice_xml']->entity_type)->toBe('fin_invoices')
        ->and($documents['invoice_xml']->mime_type)->toBe('application/xml')
        ->and($documents['invoice_xml']->sha256)->toBe(hash('sha256', $xml))
        ->and($documents['invoice_cdr']->file_name)->toStartWith('R-')->toEndWith(str_replace('B001-', '-03-B001-', $number).'.xml')
        ->and($xml)->toContain("<cbc:ID>{$number}</cbc:ID>")->toContain('Familia Castañeda &amp; Ugarte')->toContain('<cbc:PayableAmount currencyID="USD">1896.66</cbc:PayableAmount>')
        ->and($cdr)->toContain('<cbc:ResponseCode>0</cbc:ResponseCode>')->toContain("La Boleta numero {$number}, ha sido aceptada");

    $detail = $this->getJson("/api/v1/finance/invoices/{$number}")->assertOk()->json('data');
    expect($detail['fiscal_files'])->toBe(['xml' => $invoice->xml_document_id, 'cdr' => $invoice->cdr_document_id]);
    $this->getJson("/api/v1/finance/invoices/{$number}/xml")->assertOk()->assertJsonPath('data.kind', 'xml');

    withinTenant(tenantA(), function () use ($invoice): void {
        DB::table('booking_reservations')->where('id', $invoice->reservation_id)->update(['client_id' => DB::table('iam_users')->where('code', 'U14')->value('client_id')]);
    });
    actingAsSeed('U14');
    $item = collect($this->getJson('/api/v1/portal/client/documents')->assertOk()->json('data.items'))->firstWhere('code', $number);
    expect(collect($item['fiscal_files'])->pluck('href', 'kind')->all())->toBe(['xml' => "/portal/documentos/{$invoice->xml_document_id}", 'cdr' => "/portal/documentos/{$invoice->cdr_document_id}"]);
    $this->get("/api/v1/documents/{$invoice->cdr_document_id}/download")->assertRedirect();
});
