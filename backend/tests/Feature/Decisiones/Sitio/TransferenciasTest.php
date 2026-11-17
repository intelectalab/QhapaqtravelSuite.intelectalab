<?php

use App\Domain\Site\Support\TransferProofs;
use App\Jobs\TransferValidationWatch;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    Storage::fake((string) config('filesystems.default'));
});

function sitioSlug(string $code): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

function sitioDate(string $slug, string $from): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= $from) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException("Sin fecha vendible para {$slug}");
}

function sitioOrder(string $email, string $reference, string $product = 'CUS-HUM-FD'): array
{
    $slug = sitioSlug($product);
    $token = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => sitioDate($slug, '2026-10-25'), 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');

    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Rosa Quispe Huamán', 'email' => $email, 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '45879632', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'terms' => true, 'privacy' => true, 'pay_mode' => 'total', 'method' => 'transferencia', 'operation_ref' => $reference,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

function sitioUpload(array $order, ?UploadedFile $file = null): TestResponse
{
    return test()->post("/api/v1/public/orders/{$order['code']}/transfer-proof", ['file' => $file ?? UploadedFile::fake()->image('constancia.jpg', 600, 400)], siteOf(extra: ['X-Order-Token' => $order['token'], 'Accept' => 'application/json']));
}

function sitioAt(string $moment): void
{
    $now = CarbonImmutable::parse($moment, 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function sitioNotices(string $event, ?string $channel = null): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)->when($channel, fn ($q) => $q->where('channel', $channel))->get());
}

function sitioAudit(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function sitioBackdate(string $reference): void
{
    withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', $reference)->update(['created_at' => now()]));
}

function sitioSettings(array $values): void
{
    actingAsSeed('U01');
    test()->putJson('/api/v1/settings/transfer-validation', $values)->assertOk();
}

it('Configuración › Pagos: valores por defecto, guarda por campo con auditoría y rechaza plazos fuera de la lista', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/settings/transfer-validation')->assertOk()->json('data');
    expect($data['alert_finance'])->toBeTrue()
        ->and($data['auto_cancel'])->toBeFalse()
        ->and($data['cancel_hours'])->toBe(24)
        ->and($data['reminder_minutes'])->toBe(60)
        ->and($data['escalate_minutes'])->toBe(120)
        ->and($data['options']['cancel_hours'])->toBe([24, 48, 72]);

    $saved = $this->putJson('/api/v1/settings/transfer-validation', ['auto_cancel' => true, 'cancel_hours' => 48, 'lock_version' => $data['lock_version']])->assertOk()->json('data');
    expect($saved['auto_cancel'])->toBeTrue()->and($saved['cancel_hours'])->toBe(48)
        ->and(sitioAudit(['entity' => 'Configuración', 'entity_id' => 'ecommerce.transfers.cancel_hours', 'action' => 'actualizar']))->toBeTrue();

    $this->putJson('/api/v1/settings/transfer-validation', ['cancel_hours' => 36])->assertStatus(422);
    $this->putJson('/api/v1/settings/transfer-validation', ['cancel_hours' => 48])->assertStatus(422)->assertJsonPath('code', 'CFG-BR-01');

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/settings/transfer-validation'))->toBeApiError(403);
    expect($this->getJson('/api/v1/settings/transfer-validation')->json('required_permissions'))->toContain('admin.settings.manage');
});

it('al informar la transferencia el cliente recibe los datos bancarios y el enlace; al subir la constancia el pedido queda «Constancia recibida» y avisa a Finanzas', function () {
    $order = sitioOrder('constancia.uno@viajes.pe', 'TR-510001');

    $email = sitioNotices('transferencia.datos', 'email')->firstWhere('recipient_address', 'constancia.uno@viajes.pe');
    expect($email)->not->toBeNull()
        ->and($email->body_rendered)->toContain('/confirmacion/'.$order['code'].'/acceso?token=')
        ->and($email->audience)->toBe('client');

    expect(sitioUpload($order, UploadedFile::fake()->create('notas.txt', 4, 'text/plain')))->toBeApiError(422, 'SIT-PROOF-01');

    $data = sitioUpload($order)->assertCreated()->json('data');
    $orderRow = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->first());
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-510001')->first());

    expect($data['status'])->toBe('pago_por_validar')
        ->and($data['proof'])->not->toBeNull()
        ->and($data['proof']['file_name'])->toBe('constancia.jpg')
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_documents')->where('doc_type', TransferProofs::DOC_TYPE)->where('entity_id', $payment->id)->exists()))->toBeTrue()
        ->and(sitioAudit(['entity' => 'Pedido web', 'entity_id' => $order['code'], 'action' => 'subir_constancia']))->toBeTrue()
        ->and(sitioNotices('transferencia.constancia', 'portal')->pluck('recipient_user_id')->all())->toContain(seedUser('U07')->getKey())
        ->and(sitioNotices('transferencia.constancia', 'email')->pluck('recipient_address')->all())->toContain(seedUser('U07')->email);

    actingAsSeed('U07');
    $row = collect($this->getJson('/api/v1/finance/payments')->assertOk()->json('data.rows'))->firstWhere('code', $payment->code);
    expect($row['proof']['file_name'])->toBe('constancia.jpg')->and($row['proof']['escalated'])->toBeFalse();
    $this->get("/api/v1/finance/payments/{$payment->code}/transfer-proof")->assertOk();

    actingAsSeed('U01');
    $ecommerce = collect($this->getJson('/api/v1/channels/ecommerce')->assertOk()->json('data.orders'))->firstWhere('code', $orderRow->code);
    expect($ecommerce['proof_at'])->not->toBeNull();
});

it('Mi cuenta: el cliente sube la constancia de su pago pendiente y no puede subirla a pagos ajenos', function () {
    $order = sitioOrder('constancia.cuenta@viajes.pe', 'TR-510002');
    $token = $this->postJson('/api/v1/public/auth/register', [
        'name' => 'Rosa Quispe Huamán', 'email' => 'constancia.cuenta@viajes.pe', 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '45879632',
        'password' => 'viaje2026', 'password_confirmation' => 'viaje2026', 'accept' => true,
    ], siteOf())->assertCreated()->json('data.token');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-510002')->value('code'));
    $other = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('kind', 'cobro')->where('status', 'aplicado')->value('code'));

    $data = $this->post("/api/v1/public/me/payments/{$payment}/transfer-proof", ['file' => UploadedFile::fake()->create('constancia.pdf', 80, 'application/pdf')], siteOf(extra: ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json']))->assertCreated()->json('data');

    expect($data['payment'])->toBe($payment)
        ->and(sitioAudit(['entity' => 'Pago', 'entity_id' => $payment, 'action' => 'subir_constancia']))->toBeTrue()
        ->and($this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => $order['token']]))->json('data.proof'))->not->toBeNull();

    $this->post("/api/v1/public/me/payments/{$other}/transfer-proof", ['file' => UploadedFile::fake()->image('c.png')], siteOf(extra: ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json']))->assertNotFound();
});

it('escalamiento en horas hábiles: 1 h sin validar recuerda a Finanzas y 2 h más escalan a Gerente y Administrador', function () {
    sitioAt('2026-09-29 10:00');
    $order = sitioOrder('constancia.escala@viajes.pe', 'TR-510003');
    sitioUpload($order)->assertCreated();
    $orderId = (string) withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->value('id'));
    $run = fn () => withinTenant(tenantA(), fn () => (new TransferValidationWatch)->handle());

    sitioAt('2026-09-29 10:40');
    $run();
    expect(sitioNotices('transferencia.recordatorio')->where('source_id', $orderId))->toBeEmpty();

    sitioAt('2026-09-29 11:05');
    $run();
    expect(sitioNotices('transferencia.recordatorio', 'portal')->where('source_id', $orderId)->pluck('recipient_user_id')->all())->toContain(seedUser('U07')->getKey())
        ->and(sitioNotices('transferencia.escalada')->where('source_id', $orderId))->toBeEmpty();

    sitioAt('2026-09-29 13:10');
    $run();
    $run();
    $escalated = sitioNotices('transferencia.escalada', 'portal')->where('source_id', $orderId);
    expect($escalated->pluck('recipient_user_id')->all())->toContain(seedUser('U01')->getKey(), seedUser('U02')->getKey())
        ->and(sitioNotices('transferencia.recordatorio', 'portal')->where('source_id', $orderId)->where('recipient_user_id', seedUser('U07')->getKey()))->toHaveCount(1)
        ->and(sitioNotices('transferencia.escalada', 'email')->where('source_id', $orderId))->not->toBeEmpty();

    actingAsSeed('U07');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-510003')->value('code'));
    expect(collect($this->getJson('/api/v1/finance/payments')->json('data.rows'))->firstWhere('code', $payment)['proof']['escalated'])->toBeTrue();
});

it('sin constancia: aviso a Finanzas a las 4 h hábiles y, con la cancelación encendida, correo al cliente 2 h antes y cancelación con liberación de cupos', function () {
    sitioSettings(['auto_cancel' => true, 'cancel_hours' => 24]);
    sitioAt('2026-09-29 10:00');
    $order = sitioOrder('constancia.vence@viajes.pe', 'TR-510004');
    sitioBackdate('TR-510004');
    $row = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->first());
    $hold = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $row->id)->first(['departure_id', 'quantity']));
    $sold = (int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold'));
    $run = fn () => withinTenant(tenantA(), fn () => (new TransferValidationWatch)->handle());

    sitioAt('2026-09-29 14:05');
    $run();
    expect(sitioNotices('transferencia.sin_validar', 'portal')->where('source_id', $row->id)->pluck('recipient_user_id')->all())->toContain(seedUser('U07')->getKey());

    sitioAt('2026-09-30 08:30');
    $run();
    expect(sitioNotices('transferencia.por_cancelar', 'email')->where('source_id', $row->id)->pluck('recipient_address')->all())->toBe(['constancia.vence@viajes.pe'])
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $row->id)->value('status')))->toBe('pago_por_validar');

    sitioAt('2026-09-30 10:05');
    $run();
    $after = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $row->id)->first());
    expect($after->status)->toBe('cancelado')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-510004')->value('status')))->toBe('rechazado')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $row->id)->value('status')))->toBe('cancelada')
        ->and((int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold')))->toBe($sold - (int) $hold->quantity)
        ->and(sitioNotices('transferencia.cancelada', 'email')->where('source_id', $row->id))->toHaveCount(1);
});

it('con la constancia subida se pausa la cancelación automática', function () {
    sitioSettings(['auto_cancel' => true, 'cancel_hours' => 24]);
    sitioAt('2026-09-29 10:00');
    $order = sitioOrder('constancia.pausa@viajes.pe', 'TR-510005');
    sitioBackdate('TR-510005');
    expect($this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => $order['token']]))->json('data.auto_cancel_at'))->not->toBeNull();
    sitioUpload($order)->assertCreated()->assertJsonPath('data.auto_cancel_at', null);

    sitioAt('2026-10-01 12:00');
    withinTenant(tenantA(), fn () => (new TransferValidationWatch)->handle());

    expect(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->value('status')))->toBe('pago_por_validar');
});

it('la conciliación bancaria sugiere el pedido web cuando el extracto trae el mismo monto', function () {
    $order = sitioOrder('concilia.uno@viajes.pe', 'TR-510008');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-510008')->first());
    $line = withinTenant(tenantA(), function () use ($payment): object {
        $statement = DB::table('fin_bank_statements')->insertGetId(['bank' => 'BCP', 'filename' => 'extracto.csv', 'format' => 'csv', 'lines_count' => 1, 'imported_by' => seedUser('U07')->getKey()]);
        DB::table('fin_bank_lines')->insert(['code' => 'BNK-SITIO-1', 'statement_id' => $statement, 'bank' => 'BCP', 'value_date' => now()->toDateString(), 'description' => 'ABONO TRANSFERENCIA', 'amount' => $payment->amount, 'currency' => $payment->currency, 'status' => 'pendiente']);

        return DB::table('fin_bank_lines')->where('code', 'BNK-SITIO-1')->first();
    });

    actingAsSeed('U07');
    $candidates = $this->getJson("/api/v1/finance/bank-lines/{$line->code}/candidates")->assertOk()->json('data');
    $match = collect($candidates)->firstWhere('code', $payment->code);
    expect($match['difference'])->toEqual(0)
        ->and($match['label'])->toContain("Pedido {$order['code']}")
        ->and($match['order'])->toBe($order['code']);
});
