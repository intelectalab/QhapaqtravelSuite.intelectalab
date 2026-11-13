<?php

use App\Domain\Crm\Support\Portfolio;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake('local'));

function exportarRow(string $id): object
{
    return withinTenant(tenantA(), fn () => DB::table('report_exports')->where('id', $id)->first());
}

function exportarAudited(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('exporta los leads en segundo plano, deja el archivo listo, lo audita y avisa a quien lo pidió', function () {
    $admin = actingAsSeed('U01');
    $expected = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->count());

    $response = $this->postJson('/api/v1/exports', ['resource' => 'crm.leads', 'filters' => []])->assertStatus(202)
        ->assertJsonPath('data.resource', 'crm.leads')
        ->assertJsonPath('data.format', 'CSV');
    $row = exportarRow($response->json('data.id'));

    expect($row->status)->toBe('disponible')
        ->and($row->report_key)->toBe('crm_leads')
        ->and((int) $row->rows_count)->toBe($expected)
        ->and(Storage::disk('local')->exists($row->file_path))->toBeTrue()
        ->and(exportarAudited(['entity' => 'Exportación', 'entity_id' => $row->code, 'action' => 'solicitar']))->toBeTrue()
        ->and(exportarAudited(['entity' => 'Exportación', 'entity_id' => $row->code, 'action' => 'exportar', 'after_value' => "{$expected} filas · CRM Leads · CSV"]))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where(['event_code' => 'exportacion.lista', 'recipient_user_id' => $admin->getKey(), 'source_id' => $row->id])->exists()))->toBeTrue();

    $csv = Storage::disk('local')->get($row->file_path);
    expect($csv)->toContain('Código')->toContain('Responsable');

    $this->get("/api/v1/reports/exports/{$row->id}/download")->assertOk();
    expect(collect($this->getJson('/api/v1/reports/exports')->assertOk()->json('data'))->pluck('code'))->toContain($row->code);
});

it('Ventas solo exporta su cartera: sus leads y la cola sin asignar', function () {
    $sales = actingAsSeed('U03');
    expect(Portfolio::ownOnly($sales))->toBeTrue();
    $expected = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->where(fn ($q) => $q->where('owner_id', $sales->getKey())->orWhereNull('owner_id'))->count());
    $total = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->count());

    $id = $this->postJson('/api/v1/exports', ['resource' => 'crm.leads'])->assertStatus(202)->json('data.id');

    expect((int) exportarRow($id)->rows_count)->toBe($expected)->toBeLessThan($total);
});

it('aplica los mismos filtros que el listado de casos y exporta en Excel', function () {
    actingAsSeed('U01');
    $open = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('status', 'abierta')->count());

    $id = $this->postJson('/api/v1/exports', ['resource' => 'crm.cases', 'filters' => ['status' => 'abierta', 'ignorado' => 'x'], 'format' => 'xlsx'])->assertStatus(202)
        ->assertJsonPath('data.filters', ['status' => 'abierta'])
        ->json('data.id');
    $row = exportarRow($id);

    expect((int) $row->rows_count)->toBe($open)
        ->and($row->format)->toBe('XLSX')
        ->and($row->scope)->toBe('filtered');
});

it('exporta oportunidades, clientes y segmentos de fidelización', function (string $resource, string $key) {
    actingAsSeed('U01');

    $id = $this->postJson('/api/v1/exports', ['resource' => $resource])->assertStatus(202)->json('data.id');
    $row = exportarRow($id);

    expect($row->status)->toBe('disponible')->and($row->report_key)->toBe($key)->and((int) $row->rows_count)->toBeGreaterThan(0);
})->with([
    ['crm.opportunities', 'crm_oportunidades'],
    ['crm.clients', 'crm_clientes'],
    ['crm.loyalty_segments', 'crm_fidelizacion'],
]);

it('el permiso es el de ver cada recurso: Finanzas exporta clientes pero no leads', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/exports', ['resource' => 'crm.clients'])->assertStatus(202);
    $denied = $this->postJson('/api/v1/exports', ['resource' => 'crm.leads']);

    expect($denied)->toBeApiError(403, 'CRM-EXP-01')
        ->and($denied->json('required_permissions'))->toBe(['crm.leads.view']);
});

it('Operaciones no puede exportar el CRM y el intento queda auditado', function () {
    actingAsSeed('U05');

    $denied = $this->postJson('/api/v1/exports', ['resource' => 'crm.opportunities']);

    expect($denied)->toBeApiError(403, 'CRM-EXP-01')
        ->and($denied->json('required_permissions'))->toBe(['crm.opportunities.manage'])
        ->and(auditExists(['entity' => 'Exportación', 'entity_id' => 'crm.opportunities', 'action' => 'exportar_denegado']))->toBeTrue();
});

it('valida el recurso y el formato', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/exports', ['resource' => 'crm.activities'])->assertStatus(422)->assertJsonValidationErrors('resource');
    $this->postJson('/api/v1/exports', ['resource' => 'crm.leads', 'format' => 'PDF'])->assertStatus(422)->assertJsonValidationErrors('format');
    $this->postJson('/api/v1/exports', [])->assertStatus(422)->assertJsonValidationErrors('resource');
});

it('solo quien pidió la exportación puede descargarla', function () {
    actingAsSeed('U01');
    $id = $this->postJson('/api/v1/exports', ['resource' => 'crm.leads'])->assertStatus(202)->json('data.id');

    actingAsSeed('U02');
    $this->getJson("/api/v1/reports/exports/{$id}/download")->assertNotFound();
});
