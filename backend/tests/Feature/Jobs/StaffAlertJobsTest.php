<?php

use App\Jobs\AlertClaimDeadlines;
use App\Jobs\MarkExpiredProviderContracts;
use App\Jobs\MonitorIncidentSla;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockScheduledJobs();
    freezeBusinessToday();
});

function dispatchForTenantA(string $class): void
{
    dispatch_sync((new $class)->forTenant((string) tenantA()->getKey()));
}

function alertsFor(string $event, string $sourceId): int
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)->where('source_id', $sourceId)->count());
}

it('el proveedor con contrato terminado pasa a vencido y avisa a gerencia una sola vez', function () {
    $id = withinTenant(tenantA(), function (): string {
        $provider = DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('ref')->first(['id']);
        DB::table('catalog_providers')->where('id', $provider->id)->update(['contract_start' => '2026-01-01', 'contract_end' => '2026-09-28']);

        return (string) $provider->id;
    });

    dispatchForTenantA(MarkExpiredProviderContracts::class);
    $first = alertsFor('proveedor.contrato_vencido', $id);
    dispatchForTenantA(MarkExpiredProviderContracts::class);

    [$status, $audit] = withinTenant(tenantA(), fn () => [
        DB::table('catalog_providers')->where('id', $id)->value('status'),
        DB::table('audit_events')->where('action', 'vencer_contrato')->count(),
    ]);

    expect($status)->toBe('vencido')
        ->and($audit)->toBe(1)
        ->and($first)->toBeGreaterThan(0)
        ->and(alertsFor('proveedor.contrato_vencido', $id))->toBe($first);
});

it('el reclamo fuera de plazo y el que vence pronto avisan al responsable una vez al día', function () {
    [$late, $soon, $far, $owner] = withinTenant(tenantA(), function (): array {
        $claims = DB::table('crm_cases')->where('is_book', true)->whereIn('book_status', ['received', 'in_review'])->orderBy('book_number')->limit(3)->pluck('id')->map(fn ($id) => (string) $id)->all();
        $owner = (string) seedUser('U02')->getKey();
        DB::table('crm_cases')->where('is_book', true)->whereIn('book_status', ['received', 'in_review'])->update(['due_date' => '2026-12-31']);
        DB::table('crm_cases')->where('id', $claims[0])->update(['due_date' => '2026-09-25', 'owner_id' => $owner]);
        DB::table('crm_cases')->where('id', $claims[1])->update(['due_date' => '2026-10-01', 'owner_id' => $owner]);

        return [...$claims, $owner];
    });

    dispatchForTenantA(AlertClaimDeadlines::class);
    dispatchForTenantA(AlertClaimDeadlines::class);

    $toOwner = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('recipient_user_id', $owner)->whereIn('source_id', [$late, $soon])->pluck('event_code')->sort()->values()->all());

    expect($toOwner)->toBe(['reclamacion.por_vencer', 'reclamacion.vencida'])
        ->and(alertsFor('reclamacion.por_vencer', $far) + alertsFor('reclamacion.vencida', $far))->toBe(0);
});

it('la incidencia abierta con SLA vencido avisa al asignado y no se repite', function () {
    [$overdue, $onTime, $assignee] = withinTenant(tenantA(), function (): array {
        $incidents = DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->orderBy('code')->limit(2)->pluck('id')->map(fn ($id) => (string) $id)->all();
        $assignee = (string) seedUser('U05')->getKey();
        DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->update(['sla_due_at' => now()->addDay()]);
        DB::table('ops_incidents')->where('id', $incidents[0])->update(['sla_due_at' => now()->subHour(), 'assignee_id' => $assignee]);

        return [...$incidents, $assignee];
    });

    dispatchForTenantA(MonitorIncidentSla::class);
    dispatchForTenantA(MonitorIncidentSla::class);

    $toAssignee = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'incidencia.sla_vencido')->where('source_id', $overdue)->where('recipient_user_id', $assignee)->count());

    expect($toAssignee)->toBe(1)
        ->and(alertsFor('incidencia.sla_vencido', $onTime))->toBe(0);
});
