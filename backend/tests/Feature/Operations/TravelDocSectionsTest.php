<?php

use App\Jobs\RemindTravelDocuments;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('el listado trae los pasajeros y el bloqueo de entradas nominativas de cada reserva', function () {
    actingAsSeed('U05');

    $data = $this->getJson('/api/v1/ops/travel-docs')->assertOk()->json('data');
    $codes = collect($data['items'])->pluck('code');
    $withEntries = collect($data['items'])->filter(fn (array $row): bool => $row['mapi'] !== null);

    expect($data['passengers'])->not->toBeEmpty()
        ->and(collect($data['passengers'])->pluck('reservation')->unique()->diff($codes)->all())->toBe([])
        ->and($data['passengers'][0])->toHaveKeys(['name', 'status', 'missing', 'identity', 'minor', 'attention'])
        ->and($data['passengers'][0])->not->toHaveKey('blocking')
        ->and($withEntries)->not->toBeEmpty()
        ->and($this->getJson('/api/v1/ops/travel-docs/passengers')->assertOk()->json('data'))->toBe($data['passengers']);

    foreach ($withEntries as $row) {
        expect(collect($row['mapi']['services'])->every(fn (array $service): bool => (bool) preg_match('/(machu|huayna)\s*picchu/i', $service['name'])))->toBeTrue()
            ->and($row['mapi']['blocked'])->toBe($row['mapi']['missing'] !== []);
    }
});

it('un pasajero sin identidad validada bloquea las entradas nominativas de su reserva', function () {
    actingAsSeed('U05');
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')
        ->whereExists(fn ($q) => $q->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id'))
        ->whereExists(fn ($q) => $q->from('booking_reservation_services as s')->whereColumn('s.reservation_id', 'r.id')->where('s.status', '<>', 'cancelado')->where('s.name', '~*', '(machu|huayna)\s*picchu'))
        ->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')->first(['r.id', 'r.code']));
    expect($reservation)->not->toBeNull();

    withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', $reservation->id)->where('doc_type', 'id_doc')->update(['status' => 'pendiente']));
    $row = collect($this->getJson('/api/v1/ops/travel-docs')->json('data.items'))->firstWhere('code', $reservation->code);

    expect($row['mapi']['blocked'])->toBeTrue()
        ->and($row['mapi']['missing'][0]['documents'])->toContain('Documento de identidad');
});

it('las reglas traen los días de aviso por defecto, las reglas aplicadas y el job de recordatorios', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/settings/travel-docs')->assertOk()->json('data');

    expect($data['reminder_days'])->toBe([15, 7, 3])
        ->and($data['job']['name'])->toBe('Recordatorio de documentos de viaje')
        ->and(collect($data['rules'])->pluck('code'))->toContain('DOC-BR-010');
});

it('Operaciones cambia los días de aviso, el job los usa y queda auditado', function () {
    actingAsSeed('U05');

    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [5, 20, 5, 10]])->assertOk()->assertJsonPath('data.reminder_days', [20, 10, 5]);

    $stored = withinTenant(tenantA(), fn () => json_decode((string) DB::table('sys_settings')->where('section', 'travel_docs')->value('values'), true));
    expect($stored['reminder_days'])->toBe([20, 10, 5])
        ->and($this->getJson('/api/v1/settings/travel-docs')->json('data.reminder_days'))->toBe([20, 10, 5])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Documentos de viaje', 'entity_id' => 'reglas', 'action' => 'editar_reglas'])->exists()))->toBeTrue();
});

it('Operaciones ejecuta los recordatorios a mano y queda registrado en el job', function () {
    lockScheduledJobs();
    Queue::fake();
    actingAsSeed('U05');

    $this->postJson('/api/v1/ops/travel-docs/jobs/reminders', [], critical())->assertStatus(202)->assertJsonPath('data.code', 'JOB-11');

    expect(withinTenant(tenantA(), fn () => DB::table('sys_job_runs as r')->join('sys_scheduled_jobs as j', 'j.id', '=', 'r.scheduled_job_id')->where('j.code', 'JOB-11')->where('r.trigger', 'manual')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Job', 'entity_id' => 'JOB-11', 'action' => 'ejecutar'])->exists()))->toBeTrue();
    Queue::assertPushed(RemindTravelDocuments::class);
});

it('valida los días de aviso y Ventas no los cambia ni ejecuta recordatorios', function () {
    lockScheduledJobs();
    actingAsSeed('U05');
    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [0, 200]])->assertStatus(422)->assertJsonValidationErrors(['reminder_days.0', 'reminder_days.1']);
    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => []])->assertStatus(422)->assertJsonValidationErrors(['reminder_days']);

    actingAsSeed('U03');
    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [10]])->assertForbidden()->assertJsonPath('required_permissions', ['operations.travel_docs']);
    $this->postJson('/api/v1/ops/travel-docs/jobs/reminders', [], critical())->assertForbidden()->assertJsonPath('required_permissions', ['operations.travel_docs']);
});

it('Ventas ve solo los pasajeros de sus propias reservas', function () {
    $user = actingAsSeed('U03');

    $data = $this->getJson('/api/v1/ops/travel-docs/passengers')->assertOk()->json('data');
    $own = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('owner_id', $user->id)->pluck('code'));

    expect(collect($data)->pluck('reservation')->unique()->diff($own)->all())->toBe([]);
});
