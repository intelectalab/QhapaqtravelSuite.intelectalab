<?php

use App\Domain\Inbox\Support\MessageCipher;
use App\Domain\Platform\Support\BookingRuleCatalog;
use App\Domain\Platform\Support\PlanFeatureRules;
use App\Domain\Shared\Errors\ApiException;
use Database\Seeders\BookingRuleCatalogSeeder;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function datos16Platform(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function datos16PlanLimit(string $plan, string $metric): ?int
{
    $value = datos16Platform()->table('plan_limits as l')->join('plans as p', 'p.id', '=', 'l.plan_id')->where('p.code', $plan)->where('l.metric', $metric)->value('l.value');

    return $value === null ? null : (int) $value;
}

it('O10: el vencimiento de un vale queda como movimiento «vencimiento» y la columna admite 12 letras', function () {
    actingAsSeed('U07');
    $card = $this->postJson('/api/v1/finance/gift-cards', ['amount' => '150.00', 'currency' => 'USD', 'recipient_name' => 'Sophie Laurent', 'recipient_email' => 'sophie@example.com'], critical())->assertOk()->json('data');
    withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('code', $card['code'])->update(['expires_at' => now()->subDay()->toDateString()]));

    $this->getJson('/api/v1/finance/gift-cards')->assertOk();

    $movement = withinTenant(tenantA(), fn () => DB::table('fin_gift_card_movements as m')->join('fin_gift_cards as g', 'g.id', '=', 'm.gift_card_id')->where('g.code', $card['code'])->where('m.amount', '<', 0)->first(['m.kind', 'm.amount', 'm.balance_after', 'm.note']));
    $width = datos16Platform()->selectOne("select character_maximum_length as width from information_schema.columns where table_name = 'fin_gift_card_movements' and column_name = 'kind'")->width;

    expect($movement->kind)->toBe('vencimiento')
        ->and((string) $movement->amount)->toBe('-150.00')
        ->and((string) $movement->balance_after)->toBe('0.00')
        ->and($movement->note)->toStartWith('Vencimiento del vale')
        ->and((int) $width)->toBe(12);
});

it('Dudas 2 y 8: el seeder del catálogo solo agrega lo que falta y no pisa lo editado por el Super Admin', function () {
    $db = datos16Platform();
    $db->table('sys_booking_rule_catalog')->where('code', 'R-GIFT-CARDS')->update(['name' => 'Vales editados por la consola']);
    $db->table('plan_rule_entitlements')->where('rule_code', 'R-GIFT-CARDS')->update(['min_plan' => 'Enterprise']);
    $db->table('plan_rule_entitlements')->where('rule_code', 'R-AI-INSIGHTS')->delete();
    $db->table('sys_booking_rule_catalog')->where('code', 'R-AI-INSIGHTS')->delete();

    $added = app(BookingRuleCatalog::class)->addMissing(BookingRuleCatalogSeeder::definitions());

    expect($added)->toBe(['catalog' => 1, 'entitlements' => 1])
        ->and($db->table('sys_booking_rule_catalog')->where('code', 'R-GIFT-CARDS')->value('name'))->toBe('Vales editados por la consola')
        ->and($db->table('plan_rule_entitlements')->where('rule_code', 'R-GIFT-CARDS')->value('min_plan'))->toBe('Enterprise')
        ->and($db->table('plan_rule_entitlements')->where('rule_code', 'R-AI-INSIGHTS')->value('min_plan'))->toBe(PlanFeatureRules::RULES['R-AI-INSIGHTS']['min_plan'])
        ->and($db->table('sys_booking_rule_catalog')->count())->toBe(count(BookingRuleCatalogSeeder::definitions()))
        ->and(app(BookingRuleCatalog::class)->addMissing(BookingRuleCatalogSeeder::definitions()))->toBe(['catalog' => 0, 'entitlements' => 0]);
});

it('Dudas 2 y 8: a las agencias existentes se les agregan las reglas que faltan sin tocar las suyas, con auditoría', function () {
    $db = datos16Platform();
    $tenant = (string) tenantA()->getKey();
    $db->table('sys_booking_rules')->where('tenant_id', $tenant)->where('code', 'R-CUTOFF')->update(['enabled' => false, 'params' => json_encode(['hours' => 99])]);
    $db->table('sys_booking_rules')->where('tenant_id', $tenant)->where('code', 'R-QR-CHECKIN')->delete();
    $before = $db->table('sys_booking_rules')->where('tenant_id', $tenant)->count();

    $added = app(BookingRuleCatalog::class)->fillTenants();

    $cutoff = $db->table('sys_booking_rules')->where('tenant_id', $tenant)->where('code', 'R-CUTOFF')->first(['enabled', 'params']);
    $qr = $db->table('sys_booking_rules')->where('tenant_id', $tenant)->where('code', 'R-QR-CHECKIN')->first(['enabled', 'rule_group', 'min_plan', 'is_custom']);
    $catalog = $db->table('sys_booking_rule_catalog')->pluck('code')->all();

    expect($added[$tenant] ?? [])->toContain('R-QR-CHECKIN')
        ->and($db->table('sys_booking_rules')->where('tenant_id', $tenant)->count())->toBe($before + count($added[$tenant]))
        ->and((bool) $cutoff->enabled)->toBeFalse()
        ->and(json_decode($cutoff->params, true))->toBe(['hours' => 99])
        ->and($qr->rule_group)->toBe(PlanFeatureRules::GROUP)->and($qr->min_plan)->toBe('Professional')->and((bool) $qr->is_custom)->toBeFalse()
        ->and($db->table('sys_booking_rules')->where('tenant_id', tenantB()->getKey())->whereIn('code', $catalog)->count())->toBe(count($catalog))
        ->and($db->table('audit_events')->where('tenant_id', $tenant)->where('entity', 'Reglas de reserva')->where('action', 'agregar_reglas')->where('after_value', 'like', '%R-QR-CHECKIN%')->exists())->toBeTrue()
        ->and(app(BookingRuleCatalog::class)->fillTenants())->toBe([]);
});

it('Dudas 2 y 8: el alta de una agencia copia las reglas del catálogo', function () {
    lockPlatformBilling();
    Queue::fake();
    actingAsPlatform();
    $body = ['commercial_name' => 'Kallpa Viajes', 'subdomain' => 'kallpaviajes', 'plan' => 'starter', 'status' => 'prueba', 'legal_name' => 'Kallpa Viajes S.A.C.', 'ruc' => '20555111222', 'fiscal_address' => 'Jr. Lima 120, Arequipa', 'business_type' => 'Operador turístico', 'sede_name' => 'Arequipa', 'sede_city' => 'Arequipa', 'sede_address' => 'Jr. Lima 120', 'admin_name' => 'Elena Mamani', 'admin_email' => 'elena@kallpaviajes.pe', 'admin_mfa' => false, 'roles' => ['tenant_admin', 'sales'], 'permission_template' => 'minimal', 'channels' => ['portal_cliente']];

    $code = $this->postJson('/api/v1/platform/tenants', $body, critical())->assertCreated()->json('data.code');

    $db = datos16Platform();
    $tenant = $db->table('tenants')->where('code', $code)->value('id');
    $catalog = $db->table('sys_booking_rule_catalog')->get(['code', 'default_enabled'])->keyBy('code');
    $rules = $db->table('sys_booking_rules')->where('tenant_id', $tenant)->get(['code', 'enabled', 'sort_order'])->keyBy('code');

    expect($rules->keys()->sort()->values()->all())->toBe($catalog->keys()->sort()->values()->all())
        ->and((bool) $rules['R-AI-ASSISTANT']->enabled)->toBe((bool) $catalog['R-AI-ASSISTANT']->default_enabled)
        ->and($rules->pluck('sort_order')->unique()->count())->toBe($rules->count());
});

it('Duda 9: el cupo de IA sale de plan_limits (100 / 1 000 / 5 000) y mantiene el 429 AI_QUOTA_EXCEEDED', function () {
    expect(datos16PlanLimit('starter', 'ai_requests'))->toBe(100)
        ->and(datos16PlanLimit('professional', 'ai_requests'))->toBe(1000)
        ->and(datos16PlanLimit('enterprise', 'ai_requests'))->toBe(5000);

    datos16Platform()->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', 'ai_requests')->update(['value' => 5]);
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('sys_ai_requests')->insert(array_map(fn (int $i) => ['kind' => 'summary', 'prompt' => "Relleno {$i}", 'status' => 'completed'], range(1, 4))));

    $this->getJson('/api/v1/ai/usage')->assertOk()->assertJsonPath('data.limit', 5)->assertJsonPath('data.remaining', 1)->assertJsonPath('data.warning', true)->assertJsonPath('data.exhausted', false);
    $this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'El último pedido del cupo'], critical())->assertStatus(202);
    expect($this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'Uno más fuera del cupo'], critical()))->toBeApiError(429, 'AI_QUOTA_EXCEEDED');

    datos16Platform()->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', 'ai_requests')->update(['value' => null]);
    $this->getJson('/api/v1/ai/usage')->assertOk()->assertJsonPath('data.limit', null)->assertJsonPath('data.exhausted', false)->assertJsonPath('data.warning', false);
});

it('Duda 9: el cupo de IA se edita en la consola › Planes como los demás límites', function () {
    lockPlatformBilling();
    actingAsPlatform();
    $plan = datos16Platform()->table('plans')->where('code', 'professional')->first();
    $limits = datos16Platform()->table('plan_limits')->where('plan_id', $plan->id)->pluck('value', 'metric')->all();

    $this->putJson('/api/v1/platform/plans/professional', [
        'price_month' => (float) $plan->price_month,
        'price_year' => (float) $plan->price_year,
        'trial_days' => (int) $plan->trial_days,
        'support_level' => $plan->support_level,
        'limits' => [...$limits, 'ai_requests' => 1500],
    ])->assertOk()->assertJsonPath('data.limits.ai_requests', 1500);

    expect(datos16PlanLimit('professional', 'ai_requests'))->toBe(1500);
    datos16Platform()->table('usage_counters')->insert(['tenant_id' => tenantA()->getKey(), 'metric' => 'ai_requests', 'day' => now()->toDateString(), 'value' => 3]);
    expect((int) datos16Platform()->table('usage_counters')->where('tenant_id', tenantA()->getKey())->where('metric', 'ai_requests')->value('value'))->toBe(3);
});

it('Duda 3: el asunto del chat web y del formulario se guarda cifrado y la bandeja lo muestra en claro', function () {
    $chat = $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Ana Torres', 'email' => 'ana.cifrado@viajes.pe', 'message' => '¿Tienen cupos para Machu Picchu en diciembre?', 'consent' => true], siteOf())->assertCreated()->json('data');
    $stored = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $chat['session'])->value('subject'));

    expect(MessageCipher::sealed((string) $stored))->toBeTrue()
        ->and((string) $stored)->not->toContain('Machu Picchu');

    actingAsSeed('U01');
    $item = collect($this->getJson('/api/v1/inbox/conversations')->assertOk()->json('data.items'))->firstWhere('code', $chat['session']);
    expect($item['subject'])->toBe('Chat web: ¿Tienen cupos para Machu Picchu en diciembre?');
});

it('Duda 3: el nombre del adjunto se guarda cifrado y se muestra y descarga con su nombre', function () {
    Storage::fake((string) config('filesystems.default'));
    actingAsSeed('U01');
    $conversation = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('channel', 'whatsapp')->orderBy('code')->first());
    withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('id', $conversation->id)->update(['last_inbound_at' => now()]));

    $upload = $this->post('/api/v1/inbox/attachments', ['file' => UploadedFile::fake()->createWithContent('pasaporte-ana.pdf', "%PDF-1.4\n%doc\n")], ['Accept' => 'application/json'])->assertSuccessful()->json('data.upload_id');
    $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/messages", ['body' => 'Adjunto el documento.', 'attachments' => [$upload]], critical())->assertSuccessful();

    $attachment = withinTenant(tenantA(), fn () => DB::table('collab_message_attachments as a')->join('collab_messages as m', 'm.id', '=', 'a.message_id')->where('m.conversation_id', $conversation->id)->orderByDesc('a.created_at')->first(['a.id', 'a.file_name']));
    expect(MessageCipher::sealed((string) $attachment->file_name))->toBeTrue()->and((string) $attachment->file_name)->not->toContain('pasaporte');

    $detail = $this->getJson("/api/v1/inbox/conversations/{$conversation->code}")->assertOk()->json('data');
    expect(collect($detail['messages'] ?? [])->flatMap(fn (array $message) => collect($message['files'] ?? [])->pluck('name'))->all())->toContain('pasaporte-ana.pdf');

    $download = $this->get("/api/v1/inbox/conversations/{$conversation->code}/attachments/{$attachment->id}", ['Accept' => 'application/json'])->assertOk();
    expect($download->headers->get('Content-Disposition'))->toContain('pasaporte-ana.pdf');
});

it('Duda 3: el asunto y el nombre del adjunto se validan a 200 caracteres antes de cifrar', function () {
    expect(fn () => MessageCipher::sealLabel(str_repeat('a', 201)))->toThrow(ApiException::class)
        ->and(MessageCipher::open(MessageCipher::sealLabel(str_repeat('ñ', 200))))->toBe(str_repeat('ñ', 200))
        ->and(MessageCipher::sealLabel(MessageCipher::seal('ya cifrado')))->toStartWith(MessageCipher::PREFIX);
});
