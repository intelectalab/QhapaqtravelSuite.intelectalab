<?php

use Illuminate\Support\Facades\DB;

function mktSegmentoDatos(array $extra = []): array
{
    return [
        'name' => 'Clientes de Perú con email',
        'description' => 'Clientes peruanos que aceptaron correos.',
        'match' => 'all',
        'rules' => [['f' => 'type', 'op' => 'eq', 'v' => 'client'], ['f' => 'country', 'op' => 'eq', 'v' => 'Perú'], ['f' => 'consent', 'op' => 'has', 'v' => 'email']],
        ...$extra,
    ];
}

function mktSegmentoAuditado(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Segmento')->where('entity_id', $code)->where('action', $action)->exists());
}

function mktSegmentoUsado(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('mkt_segments as s')->join('mkt_campaigns as c', 'c.segment_id', '=', 's.id')->whereNull('s.deleted_at')->orderBy('s.code')->value('s.code'));
}

it('la vista previa cuenta en vivo, desglosa por tipo y canal y muestra hasta 10 contactos', function () {
    actingAsSeed('U01');

    $all = $this->postJson('/api/v1/marketing/segments/preview', ['match' => 'all', 'rules' => []])->assertOk()->json('data');
    $clients = $this->postJson('/api/v1/marketing/segments/preview', ['match' => 'all', 'rules' => [['f' => 'type', 'op' => 'eq', 'v' => 'client']]])->assertOk()->json('data');

    expect($all['matched'])->toBeGreaterThan($clients['matched'])
        ->and(collect($clients['by_type'])->firstWhere('type', 'client')['count'])->toBe($clients['matched'])
        ->and(collect($clients['by_type'])->firstWhere('type', 'lead')['count'])->toBe(0)
        ->and($clients['email']['matched'])->toBe($clients['matched'])
        ->and($clients['email']['eligible'] + $clients['email']['optout'] + $clients['email']['nodata'] + $clients['email']['consent'])->toBe($clients['matched'])
        ->and(count($clients['sample']))->toBeLessThanOrEqual(10)
        ->and($clients['rules_text'])->toBe('Tipo de contacto es Cliente');

    expect($this->postJson('/api/v1/marketing/segments/preview', ['match' => 'all', 'rules' => [['f' => 'spent', 'op' => 'contains', 'v' => 'x']]]))->toBeApiError(422, 'MKT-BR-13');
    expect($this->postJson('/api/v1/marketing/segments/preview', ['match' => 'all', 'rules' => [['f' => 'salario', 'op' => 'eq', 'v' => 'x']]]))->toBeApiError(422, 'MKT-BR-13');
});

it('crear un segmento valida reglas y nombre único, guarda y queda auditado', function () {
    $actor = actingAsSeed('U01');

    $code = $this->postJson('/api/v1/marketing/segments', mktSegmentoDatos())->assertCreated()->json('data.code');
    $row = rowOf('mkt_segments', $code);

    expect($row->owner_id)->toBe($actor->id)
        ->and(json_decode($row->rules, true))->toHaveCount(3)
        ->and(mktSegmentoAuditado($code, 'crear'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/marketing/segments')->assertOk()->json('data'))->pluck('code'))->toContain($code);

    expect($this->postJson('/api/v1/marketing/segments', mktSegmentoDatos(['name' => 'clientes de perú con EMAIL'])))->toBeApiError(422, 'MKT-BR-13');
    expect($this->postJson('/api/v1/marketing/segments', mktSegmentoDatos(['name' => 'Otro', 'rules' => [['f' => 'nps', 'op' => 'gte', 'v' => 15]]])))->toBeApiError(422);
    $this->postJson('/api/v1/marketing/segments', mktSegmentoDatos(['name' => 'No', 'match' => 'some']))->assertStatus(422)->assertJsonValidationErrors(['name', 'match']);
});

it('la ficha del segmento trae vista previa, campañas que lo usan e historial', function () {
    actingAsSeed('U01');
    $code = mktSegmentoUsado();

    $data = $this->getJson("/api/v1/marketing/segments/{$code}")->assertOk()->json('data');

    expect($data['campaigns'])->not->toBeEmpty()
        ->and($data['preview'])->toHaveKeys(['matched', 'by_type', 'email', 'whatsapp', 'sample'])
        ->and($data['lock_version'])->toBeInt();
    expect($this->getJson('/api/v1/marketing/segments/SEG-999'))->toBeApiError(404);
});

it('editar un segmento exige versión vigente y deja el antes y después en la auditoría', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/marketing/segments', mktSegmentoDatos())->assertCreated()->json('data.code');
    $version = (int) rowOf('mkt_segments', $code)->lock_version;

    $this->putJson("/api/v1/marketing/segments/{$code}", mktSegmentoDatos(['name' => 'Clientes de Perú o con NPS alto', 'match' => 'any', 'rules' => [['f' => 'country', 'op' => 'eq', 'v' => 'Perú'], ['f' => 'nps', 'op' => 'gte', 'v' => 9]]]), critical($version))->assertOk();

    $row = rowOf('mkt_segments', $code);
    expect($row->match)->toBe('any')
        ->and((int) $row->lock_version)->toBe($version + 1)
        ->and(mktSegmentoAuditado($code, 'editar'))->toBeTrue();
    expect($this->putJson("/api/v1/marketing/segments/{$code}", mktSegmentoDatos(), critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect($this->putJson("/api/v1/marketing/segments/{$code}", mktSegmentoDatos(), ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
});

it('duplicar crea una copia con nombre propio y eliminar no aplica a segmentos usados por campañas', function () {
    actingAsSeed('U01');
    $used = mktSegmentoUsado();

    $copy = $this->postJson("/api/v1/marketing/segments/{$used}/duplicate")->assertCreated()->json('data.code');
    expect(rowOf('mkt_segments', $copy)->name)->toEndWith('(copia)')
        ->and(rowOf('mkt_segments', $copy)->rules)->toBe(rowOf('mkt_segments', $used)->rules)
        ->and(mktSegmentoAuditado($copy, 'duplicar'))->toBeTrue();

    expect($this->deleteJson("/api/v1/marketing/segments/{$used}", [], critical((int) rowOf('mkt_segments', $used)->lock_version)))->toBeApiError(409, 'MKT-BR-12');

    $this->deleteJson("/api/v1/marketing/segments/{$copy}", [], critical((int) rowOf('mkt_segments', $copy)->lock_version))->assertOk();
    expect(rowOf('mkt_segments', $copy)->deleted_at)->not->toBeNull()
        ->and(mktSegmentoAuditado($copy, 'eliminar'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/marketing/segments')->json('data'))->pluck('code'))->not->toContain($copy);
});

it('Ventas no gestiona segmentos', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/marketing/segments'))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/segments', mktSegmentoDatos()))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/segments/preview', ['match' => 'all', 'rules' => []]))->toBeApiError(403);
});
