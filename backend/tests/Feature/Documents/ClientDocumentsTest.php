<?php

use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Shared\Money\Decimal;
use App\Jobs\GenerateDocumentPdf;
use Illuminate\Bus\UniqueLock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Storage::fake((string) config('filesystems.default'), ['serve' => true]);
});

function pdfAccept(array $extra = []): array
{
    return ['Accept' => 'application/pdf', ...$extra];
}

function expectPdf(TestResponse $response, string $fileName): string
{
    $response->assertOk();
    $body = (string) $response->getContent();

    expect($response->headers->get('Content-Type'))->toBe('application/pdf')
        ->and(substr($body, 0, 4))->toBe('%PDF')
        ->and((string) $response->headers->get('Content-Disposition'))->toContain($fileName)
        ->and(strlen($body))->toBeLessThan(400 * 1024);

    $folder = getenv('QTS_PDF_SAMPLES');

    if (is_string($folder) && $folder !== '') {
        @mkdir($folder, 0777, true);
        file_put_contents(rtrim($folder, '/').'/'.$fileName, $body);
    }

    return $body;
}

function documentHtml(string $kind, string $entityId): string
{
    return withinTenant(tenantA(), fn () => app(ClientDocuments::class)->draft($kind, $entityId)->html());
}

function documentAudited(string $entity, string $entityId, string $action): bool
{
    return withinTenant(tenantA(), fn (): bool => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $entityId, 'action' => $action])->exists());
}

function linkVoucherToOrder(string $reservation, string $order, string $token): void
{
    withinTenant(tenantA(), function () use ($reservation, $order, $token) {
        $orderId = DB::table('channel_ecom_orders')->where('code', $order)->value('id');
        DB::table('channel_ecom_orders')->where('id', $orderId)->update(['access_token_hash' => hash('sha256', $token)]);
        DB::table('booking_reservations')->where('code', $reservation)->update(['ecom_order_id' => $orderId]);
    });
}

it('entrega la propuesta de la cotización como PDF con nombre legible y la registra en sys_documents', function () {
    actingAsSeed('U01');

    expectPdf($this->get('/api/v1/quotes/COT-2026-00185/versions/1/pdf', pdfAccept()), 'COT-2026-00185-v1.pdf');

    $version = withinTenant(tenantA(), fn () => DB::table('quote_versions as v')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->where('q.code', 'COT-2026-00185')->where('v.version_no', 1)->first(['v.id', 'v.pdf_document_id']));
    $document = withinTenant(tenantA(), fn () => DB::table('sys_documents')->where('id', $version->pdf_document_id)->first());

    expect($document->doc_type)->toBe('propuesta_cotizacion')
        ->and($document->mime_type)->toBe('application/pdf')
        ->and($document->file_name)->toBe('COT-2026-00185-v1.pdf')
        ->and(Storage::disk($document->storage_disk)->exists($document->storage_path))->toBeTrue()
        ->and(documentAudited('Cotización', 'COT-2026-00185', 'generar_pdf'))->toBeTrue();

    $this->getJson('/api/v1/quotes/COT-2026-00185/versions/1/pdf')->assertOk()
        ->assertJsonPath('data.file_name', 'COT-2026-00185-v1.pdf')
        ->assertJsonPath('data.document_id', $document->id)
        ->assertJsonPath('data.mime_type', 'application/pdf')
        ->assertJson(fn ($json) => $json->where('data.url', fn ($url) => is_string($url) && $url !== '')->etc());

    expect(withinTenant(tenantA(), fn () => DB::table('sys_documents')->where('entity_id', $version->id)->count()))->toBe(1);
});

it('arma la propuesta con agencia, cliente, itinerario por día, precios y políticas, sin costos internos', function () {
    $versionId = withinTenant(tenantA(), fn () => (string) DB::table('quote_quotes')->where('code', 'COT-2026-00185')->value('current_version_id'));
    $html = documentHtml(ClientDocuments::QUOTE, $versionId);
    $cost = withinTenant(tenantA(), fn () => DB::table('quote_versions')->where('id', $versionId)->value('cost_total'));

    expect($html)->toContain(tenantA()->commercial_name)
        ->toContain('RUC 20')
        ->toContain('COT-2026-00185 · versión 1')
        ->toContain('Cusco Mágico 5D/4N')
        ->toContain('Paracas e Islas Ballestas desde Lima')
        ->toContain('Día 1')
        ->toContain('Valle Sagrado de los Incas')
        ->toContain('S/ 3 650.00')
        ->toContain('Sin penalidad hasta 15 días antes')
        ->toContain('Para confirmar el viaje se abona el 40 %')
        ->not->toContain('Tarifa B2B')
        ->not->toContain('Margen')
        ->not->toContain(Decimal::display((string) $cost, 'PEN'));
});

it('encola la propuesta en la cola documents con 202 y avisa cuando ya está lista', function () {
    actingAsSeed('U01');
    Queue::fake();
    $versionId = withinTenant(tenantA(), fn () => (string) DB::table('quote_quotes')->where('code', 'COT-2026-00185')->value('current_version_id'));
    $lock = new UniqueLock(app('cache')->driver());
    $lock->release((new GenerateDocumentPdf(ClientDocuments::QUOTE, $versionId))->forTenant(tenantA()->getKey()));

    $this->postJson('/api/v1/quotes/COT-2026-00185/versions/1/pdf')->assertStatus(202)
        ->assertJsonPath('data.status', 'en_cola')
        ->assertJsonPath('data.file_name', 'COT-2026-00185-v1.pdf');

    Queue::assertPushedOn('documents', GenerateDocumentPdf::class, fn (GenerateDocumentPdf $job) => $job->kind === 'quote' && $job->entityId === $versionId && $job->tenantId === tenantA()->getKey());
    $lock->release((new GenerateDocumentPdf(ClientDocuments::QUOTE, $versionId))->forTenant(tenantA()->getKey()));

    withinTenant(tenantA(), fn () => app(ClientDocuments::class)->generate(ClientDocuments::QUOTE, $versionId, GenerateDocumentPdf::class));

    $this->postJson('/api/v1/quotes/COT-2026-00185/versions/1/pdf')->assertStatus(202)->assertJsonPath('data.status', 'listo');
    expect(withinTenant(tenantA(), fn () => DB::table('sys_documents')->where('entity_id', $versionId)->value('generated_by_job')))->toBe('GenerateDocumentPdf');
});

it('respeta la cartera del asesor y responde 404 para la versión inexistente', function () {
    actingAsSeed('U03');

    expect($this->get('/api/v1/quotes/COT-2026-00185/versions/1/pdf', pdfAccept()))->toBeApiError(403, 'SEC-BR-09');
    expectPdf($this->get('/api/v1/quotes/COT-2026-00183/versions/1/pdf', pdfAccept()), 'COT-2026-00183-v1.pdf');
    $this->get('/api/v1/quotes/COT-2026-00183/versions/9/pdf', pdfAccept())->assertNotFound();
});

it('entrega la confirmación de la reserva con servicios, pasajeros y pagos', function () {
    actingAsSeed('U01');

    expectPdf($this->get('/api/v1/reservations/RES-2026-000350/documents/confirmation', pdfAccept()), 'RES-2026-000350-confirmacion.pdf');

    $reservationId = idOf('booking_reservations', 'RES-2026-000350');
    $passenger = withinTenant(tenantA(), fn () => (string) DB::table('booking_passengers')->where('reservation_id', $reservationId)->orderBy('seq')->value('full_name'));
    $html = documentHtml(ClientDocuments::CONFIRMATION, $reservationId);

    expect($html)->toContain('Confirmación de reserva')
        ->toContain('RES-2026-000350')
        ->toContain('Hotel Piedra Viva Boutique')
        ->toContain('Por confirmar')
        ->toContain($passenger)
        ->toContain('Total de la reserva')
        ->toContain('Políticas de la reserva');
});

it('no emite confirmación de una reserva cancelada', function () {
    actingAsSeed('U01');

    expect($this->get('/api/v1/reservations/RES-2026-000343/documents/confirmation', pdfAccept()))->toBeApiError(409, 'RESERVATION_STATE');
});

it('entrega el voucher en Operaciones, lo enlaza como PDF vigente y bloquea a quien no opera', function () {
    actingAsSeed('U05');

    expectPdf($this->get('/api/v1/ops/vouchers/VOU-2026-01201/pdf', pdfAccept()), 'VOU-2026-01201-v1.pdf');

    $voucher = rowOf('ops_vouchers', 'VOU-2026-01201');
    $html = documentHtml(ClientDocuments::VOUCHER, (string) $voucher->id);

    expect($voucher->document_id)->not->toBeNull()
        ->and($html)->toContain('Voucher de servicio')
        ->toContain('Machu Picchu Full Day')
        ->toContain('FSA-6M1P2')
        ->toContain('Código de verificación')
        ->toContain('Entrada a Machu Picchu Circuito 2');

    actingAsSeed('U03');
    expect($this->get('/api/v1/ops/vouchers/VOU-2026-01201/pdf', pdfAccept()))->toBeApiError(403);
});

it('no entrega el PDF de un voucher anulado', function () {
    withinTenant(tenantA(), fn () => DB::table('ops_vouchers')->where('code', 'VOU-2026-01204')->update(['status' => 'anulado', 'void_reason' => 'Prueba', 'void_at' => now()]));
    actingAsSeed('U05');

    expect($this->get('/api/v1/ops/vouchers/VOU-2026-01204/pdf', pdfAccept()))->toBeApiError(409, 'VOUCHER_VOIDED');
});

it('entrega la representación impresa del comprobante con datos fiscales y leyendas, y audita la descarga', function () {
    actingAsSeed('U07');

    expectPdf($this->get('/api/v1/finance/invoices/F001-00001482/pdf', pdfAccept()), 'F001-00001482.pdf');

    $invoice = rowOf('fin_invoices', 'F001-00001482', column: 'number');
    $html = documentHtml(ClientDocuments::INVOICE, (string) $invoice->id);

    expect($invoice->pdf_document_id)->not->toBeNull()
        ->and(documentAudited('Comprobante', 'F001-00001482', 'solicitar_pdf'))->toBeTrue()
        ->and($html)->toContain('Factura electrónica')
        ->toContain('RUC '.tenantA()->ruc)
        ->toContain('RUC 20100088771')
        ->toContain('Op. gravada')
        ->toContain('S/ 3 576.20')
        ->toContain('S/ 23 444.00')
        ->toContain('SON: VEINTITRÉS MIL CUATROCIENTOS CUARENTA Y CUATRO CON 00/100 SOLES')
        ->toContain('Representación impresa de la factura electrónica')
        ->toContain('no tiene validez tributaria');

    $credit = documentHtml(ClientDocuments::INVOICE, (string) rowOf('fin_invoices', 'F001-00001483', column: 'number')->id);
    expect($credit)->toContain('Nota de crédito electrónica')->toContain('Documento que modifica')->toContain('Op. exportación');
});

it('solo imprime comprobantes aceptados por el OSE y exige el permiso de facturación', function () {
    withinTenant(tenantA(), fn () => DB::table('fin_invoices')->where('number', 'B001-00008811')->update(['status' => 'pendiente_envio']));
    actingAsSeed('U07');

    expect($this->get('/api/v1/finance/invoices/B001-00008811/pdf', pdfAccept()))->toBeApiError(409, 'FIN-BR-47');

    actingAsSeed('U05');
    expect($this->get('/api/v1/finance/invoices/F001-00001482/pdf', pdfAccept()))->toBeApiError(403);
});

it('el cliente del portal baja solo sus propuestas', function () {
    actingAsSeed('U14');

    expectPdf($this->get('/api/v1/portal/client/quotes/COT-2026-00184/pdf', pdfAccept()), 'COT-2026-00184-v1.pdf');
    $this->get('/api/v1/portal/client/quotes/COT-2026-00185/pdf', pdfAccept())->assertNotFound();

    actingAsSeed('U15');
    expect($this->get('/api/v1/portal/client/quotes/COT-2026-00183/pdf', pdfAccept()))->toBeApiError(403);
});

it('el cliente y el pasajero bajan el itinerario de su viaje y no el ajeno', function () {
    actingAsSeed('U14');

    expectPdf($this->get('/api/v1/portal/client/reservations/RES-2026-000344/itinerary.pdf', pdfAccept()), 'RES-2026-000344-itinerario.pdf');
    $this->get('/api/v1/portal/client/reservations/RES-2026-000350/itinerary.pdf', pdfAccept())->assertNotFound();

    actingAsSeed('U15');
    expectPdf($this->get('/api/v1/portal/client/reservations/RES-2026-000347/itinerary.pdf', pdfAccept()), 'RES-2026-000347-itinerario.pdf');

    $html = documentHtml(ClientDocuments::ITINERARY, idOf('booking_reservations', 'RES-2026-000347'));
    expect($html)->toContain('Itinerario de viaje')->toContain('Día a día')->toContain('Voucher VOU-2026-01201')->toContain('Contactos durante el viaje');
});

it('la agencia B2B baja solo los vouchers de sus reservas', function () {
    $agency = seedUser('U13')->agency_id;
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', 'RES-2026-000347')->update(['channel' => 'B2B', 'agency_id' => $agency]));
    actingAsSeed('U13');

    expectPdf($this->get('/api/v1/b2b/vouchers/VOU-2026-01201/pdf', pdfAccept()), 'VOU-2026-01201-v1.pdf');
    $this->get('/api/v1/b2b/vouchers/VOU-2026-01204/pdf', pdfAccept())->assertNotFound();
    $this->getJson('/api/v1/b2b/vouchers/VOU-2026-01201/pdf')->assertOk()->assertJsonPath('data.file_name', 'VOU-2026-01201-v1.pdf');
});

it('el sitio público entrega el voucher del pedido solo con su token', function () {
    linkVoucherToOrder('RES-2026-000347', 'WEB-10432', 'token-del-pedido');

    $order = $this->getJson('/api/v1/public/orders/WEB-10432', siteOf('andes', ['X-Order-Token' => 'token-del-pedido']))->assertOk();
    expect(collect($order->json('data.reservations'))->pluck('vouchers')->flatten(1)->pluck('code')->all())->toContain('VOU-2026-01201');

    expectPdf($this->get('/api/v1/public/orders/WEB-10432/vouchers/VOU-2026-01201.pdf', siteOf('andes', pdfAccept(['X-Order-Token' => 'token-del-pedido']))), 'VOU-2026-01201-v1.pdf');
    $this->get('/api/v1/public/orders/WEB-10432/vouchers/VOU-2026-01201.pdf', siteOf('andes', pdfAccept(['X-Order-Token' => 'otro'])))->assertNotFound();
    $this->get('/api/v1/public/orders/WEB-10432/vouchers/VOU-2026-01204.pdf', siteOf('andes', pdfAccept(['X-Order-Token' => 'token-del-pedido'])))->assertNotFound();
    $this->get('/api/v1/public/orders/WEB-10432/vouchers/VOU-2026-01201.pdf', siteOf('altiplano', pdfAccept(['X-Order-Token' => 'token-del-pedido'])))->assertNotFound();
    expect($this->get('/api/v1/public/orders/WEB-10432/vouchers/VOU-2026-01201.pdf', siteOf('selva', pdfAccept(['X-Order-Token' => 'token-del-pedido']))))->toBeApiError(403, 'FEATURE_NOT_IN_PLAN');
});

it('genera la ficha comercial del producto, la reutiliza si no cambió y se descarga desde la bitácora de documentos', function () {
    actingAsSeed('U01');

    $first = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/sheet', [], critical())->assertOk()->json();
    $again = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/sheet', [], critical())->assertOk()->json();
    $html = documentHtml(ClientDocuments::SHEET, idOf('catalog_products', 'CUS-HUM-FD'));

    expect($first['meta']['file_name'])->toBe('ficha-CUS-HUM-FD.pdf')
        ->and($again['meta']['document_id'])->toBe($first['meta']['document_id'])
        ->and($html)->toContain('Ficha comercial')->toContain('Precio desde')->not->toContain('Costo')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('action', 'generar_ficha')->where('entity_id', 'CUS-HUM-FD')->count()))->toBe(1);

    $this->get("/api/v1/documents/{$first['meta']['document_id']}/download")->assertRedirect();
    expect($this->postJson('/api/v1/catalog/products/NO-EXISTE/sheet', [], critical()))->toBeApiError(404);
});

it('otro tenant no alcanza los documentos de la agencia', function () {
    actingAsTenantBAdmin();

    $this->get('/api/v1/ops/vouchers/VOU-2026-01201/pdf', pdfAccept())->assertNotFound();
    $this->get('/api/v1/finance/invoices/F001-00001482/pdf', pdfAccept())->assertNotFound();
    $this->get('/api/v1/reservations/RES-2026-000350/documents/confirmation', pdfAccept())->assertNotFound();
});
