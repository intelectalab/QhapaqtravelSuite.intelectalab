<?php

use App\Domain\Admin\Support\NotificationRules;
use App\Domain\Shared\Time\BusinessHours;
use App\Domain\Shared\Time\BusinessSchedule;
use App\Domain\Site\Actions\WebChat;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

function baseWeek(array $overrides = []): array
{
    $days = BusinessSchedule::defaultDays();
    $days['sat'] = ['open' => true, 'from' => '09:00', 'to' => '13:00'];

    return array_replace_recursive($days, $overrides);
}

function baseLima(string $moment): CarbonImmutable
{
    return CarbonImmutable::parse($moment, 'America/Lima');
}

it('sin horario cargado usa lunes a viernes de 08:00 a 19:00', function () {
    $schedule = BusinessSchedule::fromDays(null);

    expect($schedule->configured)->toBeFalse()
        ->and($schedule->summary())->toBe('Lun a vie 08:00–19:00')
        ->and($schedule->summary('en'))->toBe('Mon–Fri 08:00–19:00')
        ->and($schedule->isOpen(baseLima('2026-11-13 08:00')))->toBeTrue()
        ->and($schedule->isOpen(baseLima('2026-11-13 19:00')))->toBeFalse()
        ->and($schedule->isOpen(baseLima('2026-11-14 10:00')))->toBeFalse()
        ->and(BusinessSchedule::fromDays(['mon' => ['open' => false]])->configured)->toBeFalse();
});

it('calcula apertura, minutos hábiles sumados y transcurridos', function () {
    $schedule = BusinessSchedule::fromDays(baseWeek());

    expect($schedule->configured)->toBeTrue()
        ->and($schedule->summary())->toBe('Lun a vie 08:00–19:00 · Sáb 09:00–13:00')
        ->and($schedule->nextOpen(baseLima('2026-11-13 10:30'))->format('Y-m-d H:i'))->toBe('2026-11-13 10:30')
        ->and($schedule->nextOpen(baseLima('2026-11-13 20:00'))->format('Y-m-d H:i'))->toBe('2026-11-14 09:00')
        ->and($schedule->nextOpen(baseLima('2026-11-14 13:00'))->format('Y-m-d H:i'))->toBe('2026-11-16 08:00')
        ->and($schedule->nextOpen(CarbonImmutable::parse('2026-11-14 03:00', 'UTC'))->format('Y-m-d H:i'))->toBe('2026-11-14 09:00')
        ->and($schedule->closesAt(baseLima('2026-11-14 10:00'))?->format('H:i'))->toBe('13:00')
        ->and($schedule->closesAt(baseLima('2026-11-14 14:00')))->toBeNull()
        ->and($schedule->addMinutes(baseLima('2026-11-13 18:00'), 240)->format('Y-m-d H:i'))->toBe('2026-11-14 12:00')
        ->and($schedule->addMinutes(baseLima('2026-11-14 12:00'), 120)->format('Y-m-d H:i'))->toBe('2026-11-16 09:00')
        ->and($schedule->addMinutes(baseLima('2026-11-13 18:00'), 60)->format('Y-m-d H:i'))->toBe('2026-11-13 19:00')
        ->and($schedule->addMinutes(baseLima('2026-11-15 22:00'), 0)->format('Y-m-d H:i'))->toBe('2026-11-16 08:00')
        ->and($schedule->minutesBetween(baseLima('2026-11-13 18:00'), baseLima('2026-11-14 12:00')))->toBe(240)
        ->and($schedule->minutesBetween(baseLima('2026-11-14 12:00'), baseLima('2026-11-16 09:00')))->toBe(120)
        ->and($schedule->minutesBetween(baseLima('2026-11-16 09:00'), baseLima('2026-11-14 12:00')))->toBe(0)
        ->and($schedule->minutesBetween(baseLima('2026-11-15 01:00'), baseLima('2026-11-15 23:00')))->toBe(0);
});

it('agrupa los días con el mismo horario y admite cierre a las 24:00', function () {
    $all = collect(BusinessSchedule::DAYS)->mapWithKeys(fn (string $day): array => [$day => ['open' => true, 'from' => '00:00', 'to' => '24:00']])->all();
    $weekend = baseWeek(['sun' => ['open' => true, 'from' => '09:00', 'to' => '13:00']]);
    $schedule = BusinessSchedule::fromDays($all);

    expect($schedule->summary())->toBe('Todos los días 00:00–24:00')
        ->and($schedule->summary('en'))->toBe('Every day 00:00–24:00')
        ->and($schedule->addMinutes(baseLima('2026-11-13 23:30'), 60)->format('Y-m-d H:i'))->toBe('2026-11-14 00:30')
        ->and(BusinessSchedule::fromDays($weekend)->summary())->toBe('Lun a vie 08:00–19:00 · Sáb y dom 09:00–13:00')
        ->and(BusinessSchedule::validRange('19:00', '08:00'))->toBeFalse()
        ->and(BusinessSchedule::validRange('24:00', '24:00'))->toBeFalse();
});

it('Configuración guarda el horario, lo audita y lo muestra con aviso mientras falte', function () {
    actingAsSeed('U01');

    $initial = $this->getJson('/api/v1/settings/business-hours')->assertOk()->json('data');
    expect($initial['configured'])->toBeFalse()
        ->and($initial['notice'])->toBe('Carga tu horario de atención')
        ->and($this->getJson('/api/v1/settings')->assertOk()->json('data.business_hours.summary.es'))->toBe('Lun a vie 08:00–19:00');

    $saved = $this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek(), 'lock_version' => $initial['lock_version']])->assertOk()->json('data');

    expect($saved['configured'])->toBeTrue()
        ->and($saved['notice'])->toBeNull()
        ->and($saved['lock_version'])->toBe($initial['lock_version'] + 1)
        ->and($saved['summary']['es'])->toBe('Lun a vie 08:00–19:00 · Sáb 09:00–13:00')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Configuración', 'entity_id' => 'general.business_hours'])->exists()))->toBeTrue();

    expect($this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek()]))->toBeApiError(422, 'CFG-BR-01')
        ->and($this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek(['mon' => ['from' => '19:00', 'to' => '08:00']])]))->toBeApiError(422, 'CFG-HRS-01')
        ->and($this->putJson('/api/v1/settings/business-hours', ['days' => collect(BusinessSchedule::DAYS)->mapWithKeys(fn (string $day): array => [$day => ['open' => false]])->all()]))->toBeApiError(422, 'CFG-HRS-02')
        ->and($this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek(['sun' => ['open' => true]]), 'lock_version' => $initial['lock_version']]))->toBeApiError(409)
        ->and($this->putJson('/api/v1/settings/business-hours', ['days' => ['mon' => ['open' => true, 'from' => '8', 'to' => '19:00']]])->status())->toBe(422);
});

it('sin permiso de configuración el horario responde 403', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/settings/business-hours')->assertForbidden();
    $this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek()])->assertForbidden()->assertJsonPath('required_permissions.0', 'admin.settings.manage');
});

it('los avisos «solo en horario de atención» esperan la apertura del horario de la agencia', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek()])->assertOk();

    withinTenant(tenantA(), function (): void {
        DB::table('notif_event_rules')->updateOrInsert(['event_code' => 'prueba.horario'], ['label' => 'prueba', 'ch_email' => true, 'ch_push' => true, 'recipients' => 'Cliente', 'timing' => 'business_hours', 'condition' => 'always']);
        $rules = app(NotificationRules::class);

        expect($rules->releaseAt('prueba.horario', baseLima('2026-11-14 10:00')))->toBeNull()
            ->and($rules->releaseAt('prueba.horario', baseLima('2026-11-14 15:00'))?->format('Y-m-d H:i'))->toBe('2026-11-16 08:00');
    });
});

it('el sitio publica el texto del horario y el chat avisa fuera de horario', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/settings/business-hours', ['days' => baseWeek()])->assertOk();

    $hours = $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.hours');
    expect($hours['summary'])->toBe(['es' => 'Lun a vie 08:00–19:00 · Sáb 09:00–13:00', 'en' => 'Mon–Fri 08:00–19:00 · Sat 09:00–13:00']);

    [$open, $closed, $sunday] = withinTenant(tenantA(), function (): array {
        $chat = app(WebChat::class);
        app(BusinessHours::class)->forget();

        return [$chat->autoReply(baseLima('2026-11-13 10:00')), $chat->autoReply(baseLima('2026-11-13 21:00')), $chat->autoReply(baseLima('2026-11-15 10:00'))];
    });

    expect($open)->not->toContain('fuera de horario')
        ->and($closed)->toContain('fuera de horario')->toContain('Lun a vie 08:00–19:00 · Sáb 09:00–13:00')->toContain('mañana a las 09:00')
        ->and($sunday)->toContain('mañana a las 08:00');
});

it('el botón de WhatsApp del sitio usa el número conectado a la bandeja y si no, el enlace del sitio', function () {
    $whatsapp = fn () => $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.agency.whatsapp');

    withinTenant(tenantA(), fn () => DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->update(['status' => 'inactivo']));
    $fallback = $whatsapp();
    expect($fallback === null || $fallback['source'] === 'site')->toBeTrue();

    withinTenant(tenantA(), function (): void {
        DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->update(['status' => 'inactivo']);
        DB::table('collab_channel_accounts')->insert(['channel' => 'whatsapp', 'name' => 'WhatsApp Business', 'phone_number_id' => '+51 984 120 450', 'status' => 'activo', 'created_at' => '2020-01-01 00:00:00']);
    });

    expect($whatsapp())->toBe(['number' => '+51984120450', 'url' => 'https://wa.me/51984120450', 'source' => 'inbox']);
});

it('el buscador sin salidas en la fecha sugiere fechas cercanas con cupo', function () {
    freezeBusinessToday();
    $far = $this->getJson('/api/v1/public/products?fecha=2031-03-03', siteOf())->assertOk()->json('data');
    expect($far['total'])->toBe(0)->and($far['nearby_dates'])->toBe([]);

    $found = null;

    foreach (array_slice($this->getJson('/api/v1/public/products', siteOf())->assertOk()->json('data.items'), 0, 12) as $item) {
        $days = collect($this->getJson("/api/v1/public/products/{$item['slug']}/calendar?mes=2026-10&viajeros=2", siteOf())->assertOk()->json('data.days'));
        $closed = $days->first(fn (array $day): bool => $day['date'] > BUSINESS_TODAY && ! in_array($day['status'], ['disponible', 'ultimos', 'pocos'], true));

        if ($closed === null) {
            continue;
        }

        $result = $this->getJson('/api/v1/public/products?q='.urlencode($item['name']).'&fecha='.$closed['date'], siteOf())->assertOk()->json('data');

        if ($result['total'] === 0 && $result['nearby_dates'] !== []) {
            $found = $result;
            break;
        }
    }

    expect($found)->not->toBeNull();
    $near = $found['nearby_dates'][0];
    expect($near['count'])->toBeGreaterThan(0)->and($near['date'] >= BUSINESS_TODAY)->toBeTrue();
});
