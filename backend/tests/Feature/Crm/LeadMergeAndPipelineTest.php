<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function fusionLead(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/crm/leads', [
        'name' => 'Fusión '.Str::random(5),
        'email' => 'fusion.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function fusionAuditado(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', $entity)->where('entity_id', $code)->where('action', $action)->exists());
}

function fusionActividad(string $relatedType, string $relatedCode): string
{
    return (string) test()->postJson('/api/v1/crm/activities', [
        'type' => 'llamada',
        'subject' => 'Seguimiento '.Str::random(4),
        'related_type' => $relatedType,
        'related_code' => $relatedCode,
        'due_at' => now()->addDays(2)->toIso8601String(),
    ])->assertCreated()->json('data.code');
}

it('fusiona un lead en otro: completa los vacíos, mueve las actividades y deja el origen como duplicado', function () {
    actingAsSeed('U02');
    $email = 'gemelo.'.Str::lower(Str::random(8)).'@prueba.pe';
    $target = fusionLead(['email' => $email, 'owner_id' => seedUser('U02')->id]);
    $source = fusionLead(['email' => $email, 'phone' => '987654321', 'company' => 'Andes SAC', 'pax' => 4, 'duplicate_resolution' => 'create_new', 'owner_id' => seedUser('U02')->id]);
    $activity = fusionActividad('lead', $source);
    $sourceRow = rowOf('crm_leads', $source);

    $this->getJson("/api/v1/crm/leads/{$target}")->assertOk()
        ->assertJsonPath('data.duplicates.0.code', $source)
        ->assertJsonPath('data.duplicates.0.mergeable', true);

    $this->postJson("/api/v1/crm/leads/{$target}/merge", ['source_lead_id' => $sourceRow->id])->assertOk()
        ->assertJsonPath('meta.activities', 1)
        ->assertJsonPath('data.absorbed.0.code', $source);

    $targetRow = rowOf('crm_leads', $target);
    $moved = rowOf('crm_activities', $activity);

    expect($targetRow->company)->toBe('Andes SAC')
        ->and($targetRow->phone)->toBe('987654321')
        ->and((int) $targetRow->pax)->toBe(4)
        ->and(rowOf('crm_leads', $source)->status)->toBe('duplicado')
        ->and(rowOf('crm_leads', $source)->duplicate_of_id)->toBe($targetRow->id)
        ->and($moved->related_id)->toBe($targetRow->id)
        ->and($moved->merged_from_lead_id)->toBe($sourceRow->id)
        ->and(fusionAuditado('Lead', $target, 'fusionar'))->toBeTrue()
        ->and(fusionAuditado('Lead', $source, 'fusionar'))->toBeTrue();

    $this->getJson("/api/v1/crm/leads/{$target}")->assertOk()->assertJsonPath('data.activities.0.code', $activity);
});

it('no fusiona leads que no coinciden ni un origen ya duplicado', function () {
    actingAsSeed('U02');
    $target = fusionLead(['owner_id' => seedUser('U02')->id]);
    $other = fusionLead();

    expect($this->postJson("/api/v1/crm/leads/{$target}/merge", ['source_lead_id' => rowOf('crm_leads', $other)->id]))->toBeApiError(422, 'CRM-BR-04')
        ->and($this->postJson("/api/v1/crm/leads/{$target}/merge", []))->toBeApiError(422);
});

it('el alta con resolución merge no crea otro lead y suma cinco puntos al existente', function () {
    actingAsSeed('U02');
    $email = 'alta.'.Str::lower(Str::random(8)).'@prueba.pe';
    $target = fusionLead(['email' => $email]);
    $before = rowOf('crm_leads', $target);
    $count = withinTenant(tenantA(), fn () => DB::table('crm_leads')->count());

    $this->postJson('/api/v1/crm/leads', ['name' => 'Repetido', 'email' => $email, 'phone' => '912345678', 'channel' => 'web', 'source' => 'formulario_web', 'interest' => 'paquete', 'duplicate_resolution' => 'merge', 'merge_into' => $target])
        ->assertCreated()->assertJsonPath('data.code', $target);

    $after = rowOf('crm_leads', $target);

    expect(withinTenant(tenantA(), fn () => DB::table('crm_leads')->count()))->toBe($count)
        ->and((int) $after->score)->toBe(min(100, (int) $before->score + 5))
        ->and($after->phone)->toBe('912345678')
        ->and($after->notes)->toContain('[Fusionado')
        ->and(fusionAuditado('Lead', $target, 'fusionar'))->toBeTrue();
});

it('marca como duplicado desde la ficha y luego lo reabre limpiando la coincidencia', function () {
    actingAsSeed('U02');
    $email = 'marca.'.Str::lower(Str::random(8)).'@prueba.pe';
    $first = fusionLead(['email' => $email]);
    $second = fusionLead(['email' => $email, 'duplicate_resolution' => 'create_new']);

    $this->postJson("/api/v1/crm/leads/{$second}/mark-duplicate", ['duplicate_of_type' => 'lead', 'duplicate_of_id' => rowOf('crm_leads', $first)->id, 'lock_version' => (int) rowOf('crm_leads', $second)->lock_version])
        ->assertOk()->assertJsonPath('data.status', 'duplicado')->assertJsonPath('data.duplicate_of.code', $first);

    expect($this->postJson("/api/v1/crm/leads/{$second}/reopen", ['lock_version' => 0]))->toBeApiError(409, 'STALE_VERSION');

    $this->postJson("/api/v1/crm/leads/{$second}/reopen", ['lock_version' => (int) rowOf('crm_leads', $second)->lock_version])
        ->assertOk()->assertJsonPath('data.status', 'nuevo')->assertJsonPath('data.duplicate_of', null);

    expect(rowOf('crm_leads', $second)->duplicate_of_id)->toBeNull()
        ->and(fusionAuditado('Lead', $second, 'marcar_duplicado'))->toBeTrue()
        ->and(fusionAuditado('Lead', $second, 'reabrir'))->toBeTrue()
        ->and($this->postJson("/api/v1/crm/leads/{$second}/reopen", ['lock_version' => (int) rowOf('crm_leads', $second)->lock_version]))->toBeApiError(409, 'LEAD_NOT_CLOSED');
});

it('el detalle del lead trae historial y la consulta de duplicados en vivo excluye al propio lead', function () {
    actingAsSeed('U02');
    $email = 'vivo.'.Str::lower(Str::random(8)).'@prueba.pe';
    $code = fusionLead(['email' => $email]);

    $this->getJson("/api/v1/crm/leads/{$code}")->assertOk()->assertJsonPath('data.history.0.action', 'crear');
    $this->getJson('/api/v1/crm/leads/duplicates?email='.urlencode($email))->assertOk()->assertJsonPath('data.0.code', $code);
    $this->getJson('/api/v1/crm/leads/duplicates?email='.urlencode($email).'&exclude='.$code)->assertOk()->assertJsonCount(0, 'data');
});

it('Ventas no reabre ni fusiona leads de otro asesor', function () {
    actingAsSeed('U02');
    $email = 'ajeno.'.Str::lower(Str::random(8)).'@prueba.pe';
    $foreign = fusionLead(['email' => $email, 'owner_id' => seedUser('U04')->id]);

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/crm/leads/{$foreign}/reopen", ['lock_version' => 0]))->toBeApiError(403);
});

it('la ficha de la actividad trae su auditoría y reasignar es una acción aparte de supervisor', function () {
    actingAsSeed('U02');
    $lead = fusionLead(['owner_id' => seedUser('U02')->id]);
    $code = fusionActividad('lead', $lead);
    $version = (int) rowOf('crm_activities', $code)->lock_version;

    $this->postJson("/api/v1/crm/activities/{$code}/reassign", ['owner_id' => seedUser('U03')->id, 'note' => 'Cubre vacaciones', 'lock_version' => $version])->assertOk();

    expect(rowOf('crm_activities', $code)->owner_id)->toBe(seedUser('U03')->id)
        ->and($this->postJson("/api/v1/crm/activities/{$code}/reassign", ['owner_id' => seedUser('U03')->id]))->toBeApiError(422, 'CRM-BR-31');

    $this->getJson("/api/v1/crm/activities/{$code}")->assertOk()
        ->assertJsonPath('data.related.code', $lead)
        ->assertJsonPath('data.history.0.action', 'reasignar');

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/crm/activities/{$code}/reassign", ['owner_id' => seedUser('U02')->id]))->toBeApiError(403);
});

it('la oportunidad trae actividades propias y del lead, cliente, cotizaciones con total y se reasigna aparte', function () {
    actingAsSeed('U02');
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('code')->value('code'));
    $code = (string) $this->postJson('/api/v1/crm/opportunities', [
        'client_code' => $client, 'title' => 'Pipeline '.Str::random(4), 'amount' => 5000, 'currency' => 'PEN', 'expected_close_date' => now()->addDays(20)->toDateString(), 'owner_id' => seedUser('U02')->id,
    ])->assertCreated()->json('data.code');
    $activity = fusionActividad('opportunity', $code);

    $this->getJson("/api/v1/crm/opportunities/{$code}")->assertOk()
        ->assertJsonPath('data.activities.0.code', $activity)
        ->assertJsonPath('data.pending_activities', 1)
        ->assertJsonPath('data.close_overdue', false)
        ->assertJsonStructure(['data' => ['client_card' => ['document', 'email', 'phone', 'contact'], 'quotes', 'history']]);

    $this->getJson('/api/v1/crm/opportunities')->assertOk()->assertJsonStructure(['data' => ['items' => [['quotes_count']]]]);

    $this->postJson("/api/v1/crm/opportunities/{$code}/reassign", ['owner_id' => seedUser('U03')->id, 'note' => 'Cartera norte'])->assertOk()
        ->assertJsonPath('data.owner.name', seedUser('U03')->name);

    expect(fusionAuditado('Oportunidad', $code, 'reasignar'))->toBeTrue();

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/crm/opportunities/{$code}/reassign", ['owner_id' => seedUser('U02')->id]))->toBeApiError(403);
});
