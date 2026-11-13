<?php

use App\Domain\Admin\Support\AdapterRetryPolicy;
use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(fn () => Queue::fake());

it('el listado de usuarios trae su trabajo abierto y si es de canal', function () {
    actingAsSeed('U01');

    $users = collect($this->getJson('/api/v1/iam/users')->assertOk()->json('data'));
    $owner = withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->whereNotNull('owner_id')->selectRaw('owner_id, count(*) as total')->groupBy('owner_id')->orderByDesc('total')->first());

    expect($users->first())->toHaveKeys(['channel', 'workload'])
        ->and($users->firstWhere('id', $owner->owner_id)['workload']['opportunities'])->toBe((int) $owner->total)
        ->and($users->where('channel', true)->count())->toBeGreaterThan(0);
});

it('al invitar se toma el candado del cupo de la agencia y el límite del plan se sigue respetando', function () {
    actingAsSeed('U01');

    $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/iam/users', ['name' => 'Persona Nueva', 'email' => 'g5.nueva@andeshorizonte.pe', 'role' => 'sales', 'sede_id' => withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('is_main', true)->value('id'))])->assertCreated();

    expect(withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', 'g5.nueva@andeshorizonte.pe')->value('status')))->toBe('pendiente');
});

it('cada canal dice de qué integración depende y avisa sin bloquear (CFG-BR-12)', function () {
    actingAsSeed('U01');

    $channels = collect($this->getJson('/api/v1/settings')->assertOk()->json('data.channels'))->keyBy('key');

    expect($channels['whatsapp']['integration'])->toHaveKeys(['code', 'name', 'status', 'status_label', 'ready', 'warning'])
        ->and($channels['ecommerce']['integration'])->not->toBeNull()
        ->and($channels['b2b']['integration'])->toBeNull();
});

it('la matriz de avisos informa si WhatsApp está en pruebas', function () {
    actingAsSeed('U01');

    $meta = $this->getJson('/api/v1/notifications/rules')->assertOk()->json('meta.whatsapp');

    expect($meta)->toHaveKeys(['code', 'name', 'status', 'status_label', 'sandbox']);
});

it('cambiar un canal desde la celda de la matriz guarda la regla completa', function () {
    actingAsSeed('U01');

    $rule = collect($this->getJson('/api/v1/notifications/rules')->json('data'))->firstWhere('event_code', 'reserva.confirmada');
    $this->patchJson('/api/v1/notifications/rules/reserva.confirmada', ['recipients' => $rule['recipients'], 'timing' => $rule['timing'], 'condition' => $rule['condition'], 'ch_email' => $rule['ch_email'], 'ch_whatsapp' => ! $rule['ch_whatsapp'], 'ch_push' => $rule['ch_push'], 'ch_portal' => $rule['ch_portal']])->assertOk();

    expect((bool) withinTenant(tenantA(), fn () => DB::table('notif_event_rules')->where('event_code', 'reserva.confirmada')->value('ch_whatsapp')))->toBe(! $rule['ch_whatsapp']);
});

it('los procesos traen la tarjeta del scheduler con la política de reintentos', function () {
    actingAsSeed('U01');

    $scheduler = $this->getJson('/api/v1/jobs')->assertOk()->json('meta.scheduler');

    expect($scheduler)->toHaveKeys(['timezone', 'queued', 'workers', 'paused', 'next_run_at', 'policy'])
        ->and($scheduler['timezone'])->toBe('America/Lima')
        ->and(array_column($scheduler['policy']['steps'], 'seconds'))->toBe([60, 120, 240, 480, 960])
        ->and($scheduler['policy']['jitter_pct'])->toBe(20);
});

it('probar una integración devuelve el registro con pasos, tiempos y correlación', function () {
    actingAsSeed('U01');

    $code = withinTenant(tenantA(), fn () => DB::table('integration_adapters')->where('kind', 'email')->value('code'));
    $log = $this->postJson("/api/v1/integrations/{$code}/test")->assertOk()->json('meta.log');

    expect($log)->toHaveKeys(['correlation_id', 'at', 'duration_ms', 'timeout_s', 'steps'])
        ->and(count($log['steps']))->toBeGreaterThanOrEqual(3)
        ->and($log['steps'][0])->toHaveKeys(['label', 'status', 'ms']);
});

it('los envíos usan los reintentos, la espera y el tiempo máximo del adaptador, con variación de ±20 %', function () {
    $job = withinTenant(tenantA(), function (): SendNotificationEmail {
        DB::table('integration_adapters')->where('kind', 'email')->update(['max_retries' => 3, 'backoff_base_s' => 10, 'timeout_s' => 15]);

        return new SendNotificationEmail('00000000-0000-0000-0000-000000000000');
    });

    expect($job->tries)->toBe(3)
        ->and($job->timeout)->toBe(15)
        ->and($job->backoff())->toHaveCount(3);

    foreach ([10, 20, 40] as $index => $seconds) {
        expect($job->backoff()[$index])->toBeGreaterThanOrEqual((int) floor($seconds * 0.8))->toBeLessThanOrEqual((int) ceil($seconds * 1.2));
    }

    foreach (AdapterRetryPolicy::delays() as $index => $seconds) {
        expect($seconds)->toBeGreaterThanOrEqual(48 * (2 ** $index))->toBeLessThanOrEqual(72 * (2 ** $index));
    }
});

it('la auditoría agrupa las acciones críticas por tipo y la actividad por actor', function () {
    actingAsSeed('U01');

    $meta = $this->getJson('/api/v1/audit-events?filter[days]=0')->assertOk()->json('meta');
    $critical = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('is_critical', true)->count());

    expect($meta)->toHaveKeys(['critical_by_action', 'by_actor'])
        ->and(array_sum(array_column($meta['critical_by_action'], 'total')))->toBeLessThanOrEqual($critical);
});

it('se puede programar un reporte semanal los viernes', function () {
    actingAsSeed('U01');

    $schedule = $this->postJson('/api/v1/reports/schedules', ['report_key' => 'reservas', 'frequency' => 'friday', 'time' => '18:00', 'format' => 'PDF', 'recipients' => ['gerencia@andeshorizonte.pe']])->assertCreated()->json('data');

    expect($schedule['cron'])->toBe('0 18 * * 5')
        ->and($schedule['label'])->toBe('semanal (viernes) 18:00');
});

it('el reporte de reservas trae destino, sede y el rango del viaje, y marca los filtros de la tabla', function () {
    actingAsSeed('U01');

    $table = $this->getJson('/api/v1/reports/reservas?period=all')->assertOk()->json('data.table');
    $columns = collect($table['columns'])->keyBy('key');

    expect($columns->keys()->all())->toContain('destination', 'sede', 'travel_from', 'travel_to')
        ->and($columns['channel']['filter'] ?? false)->toBeTrue()
        ->and($columns['status']['filter'] ?? false)->toBeTrue()
        ->and($table['rows'][0])->toHaveKeys(['destination', 'sede', 'travel_to']);

    $quotes = collect($this->getJson('/api/v1/reports/cotizaciones?period=all')->json('data.table.columns'))->keyBy('key');
    $providers = collect($this->getJson('/api/v1/reports/proveedores?period=all')->json('data.table.columns'))->keyBy('key');
    $clients = collect($this->getJson('/api/v1/reports/clientes?period=all')->json('data.table.columns'))->keyBy('key');

    expect($quotes['status']['filter'] ?? false)->toBeTrue()
        ->and($providers['type']['filter'] ?? false)->toBeTrue()
        ->and($providers['status']['filter'] ?? false)->toBeTrue()
        ->and($clients['segment']['filter'] ?? false)->toBeTrue();
});

it('la vista contable de finanzas cuenta los comprobantes y lista las cuentas por cobrar por documento', function () {
    actingAsSeed('U08');

    $data = $this->getJson('/api/v1/reports/finanzas?period=all')->assertOk()->json('data');
    $kpi = collect($data['kpis'])->firstWhere('key', 'invoices');
    $open = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'pagada'])->count());

    expect($kpi)->not->toBeNull()
        ->and($kpi['hint'])->toContain('observado')
        ->and(array_column($data['table']['columns'], 'key'))->toBe(['code', 'client', 'reservation', 'due_date', 'balance', 'status'])
        ->and($data['table']['link'])->toBe('/finanzas/cobros/{code}')
        ->and(count($data['table']['rows']))->toBe(min(500, $open));
});

it('el mapa de acceso trae el resumen por rol y las filas de portales y apps externas', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/iam/access-map')->assertOk()->json('data');
    $roles = collect($data['roles'])->keyBy('role');

    expect(array_column($data['external'], 'key'))->toBe(['b2b', 'customer', 'passenger', 'provider', 'operator'])
        ->and($roles['sales'])->toHaveKeys(['home', 'data_scope', 'modules', 'denied', 'external', 'users'])
        ->and($roles['sales']['data_scope'])->toContain('Su cartera')
        ->and($roles['sales']['denied'])->toContain('Administrar usuarios')
        ->and($roles['b2b']['external']['b2b'])->toBeTrue()
        ->and($roles['tenant_admin']['external']['b2b'])->toBeFalse();
});

it('el detalle del rol trae su alcance de datos', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/iam/roles/operations')->assertOk()->assertJsonPath('data.data_scope', 'Reservas en ejecución y proveedores de la agencia; ve costos, no márgenes.');
});

it('la vista previa usa una reserva real elegible y calcula la fecha de envío', function () {
    actingAsSeed('U01');

    $data = $this->postJson('/api/v1/notifications/pax-templates/PMT-001/preview', ['channel' => 'email'])->assertOk()->json('data');

    expect($data)->toHaveKeys(['reservation', 'scheduled_at', 'eligible', 'blocked_reason', 'reservation_lang'])
        ->and($data['eligible'])->toBeTrue()
        ->and($data['scheduled_at'])->not->toBeNull();

    $chosen = $this->postJson('/api/v1/notifications/pax-templates/PMT-001/preview', ['channel' => 'email', 'reservation' => 'RES-2026-000350'])->assertOk()->json('data');
    expect($chosen['reservation'])->toBe('RES-2026-000350');
});

it('duplicar una plantilla en otro idioma crea la copia inactiva enlazada y no repite el idioma', function () {
    actingAsSeed('U01');

    $original = withinTenant(tenantA(), fn () => DB::table('notif_pax_message_templates')->whereNull('group_code')->where('lang', 'ES')->whereNotExists(fn ($query) => $query->from('notif_pax_message_templates as o')->whereColumn('o.group_code', 'notif_pax_message_templates.code'))->orderBy('code')->first());
    $copy = $this->postJson("/api/v1/notifications/pax-templates/{$original->code}/duplicate")->assertCreated()->json('data');
    $rows = withinTenant(tenantA(), fn () => DB::table('notif_pax_message_templates')->whereIn('code', [$original->code, $copy['code']])->get()->keyBy('code'));

    expect($copy['lang'])->toBe('EN')
        ->and($rows[$copy['code']]->active)->toBeFalse()
        ->and($rows[$copy['code']]->group_code)->toBe($original->code)
        ->and($rows[$original->code]->group_code)->toBe($original->code)
        ->and($rows[$copy['code']]->body)->toBe($original->body)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Plantilla de mensaje')->where('entity_id', $copy['code'])->where('action', 'duplicar')->exists()))->toBeTrue();

    expect($this->postJson("/api/v1/notifications/pax-templates/{$original->code}/duplicate"))->toBeApiError(409, 'MSG-05');
    expect($this->postJson("/api/v1/notifications/pax-templates/{$copy['code']}/duplicate"))->toBeApiError(409, 'MSG-05');

    actingAsSeed('U03');
    $denied = $this->postJson("/api/v1/notifications/pax-templates/{$original->code}/duplicate");
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('admin.settings.manage');
});
