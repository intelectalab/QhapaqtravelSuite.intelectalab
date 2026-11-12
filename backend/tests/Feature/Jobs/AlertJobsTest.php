<?php

use App\Jobs\ApprovalSlaCheck;
use App\Jobs\CatalogValidityAlerts;
use App\Jobs\ReleaseDueAlerts;
use App\Jobs\RemindPendingSupplierRequests;
use App\Jobs\ResourceDocumentAlerts;
use App\Jobs\TenantJob;
use Illuminate\Support\Facades\DB;

function runAlertJob(TenantJob $job): string
{
    dispatch_sync($job->forTenant((string) tenantA()->getKey()));

    return (string) DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', $job::class)->orderByDesc('started_at')->value('result');
}

it('JOB-23 avisa a Operaciones de las fechas de cupo con release en 3 días o menos', function () {
    $day = withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days as d')->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')->whereIn('a.status', ['activo', 'en_release'])->whereNull('d.closed_at')->first(['d.id', 'a.id as allotment']));
    expect($day)->not->toBeNull();
    withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days')->where('id', $day->id)->update(['release_deadline' => BUSINESS_TODAY, 'retained_at' => null, 'blocked_qty' => 10, 'released_qty' => 0, 'used_qty' => 0, 'pending_qty' => 0]));

    expect(runAlertJob(new ReleaseDueAlerts))->toContain('release próximo')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'cupo.release_proximo')->where('source_id', $day->allotment)->exists()))->toBeTrue();
});

it('JOB-24 avisa del SOAT por vencer', function () {
    $vehicle = withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->whereNull('deleted_at')->value('id'));
    withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->where('id', $vehicle)->update(['soat_expires_on' => now()->addDays(10)->toDateString()]));

    runAlertJob(new ResourceDocumentAlerts);

    expect(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'recurso.documento_vence')->where('source_id', $vehicle)->exists()))->toBeTrue();
});

it('JOB-25 avisa del producto activo sin tarifa vigente', function () {
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->value('id'));
    withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', $product)->update(['status' => 'inactiva']));

    expect(runAlertJob(new CatalogValidityAlerts))->toContain('sin tarifa')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'producto.sin_tarifa')->where('source_id', $product)->exists()))->toBeTrue();
});

it('JOB-26 recuerda al proveedor la solicitud sin respuesta una sola vez al día', function () {
    $request = withinTenant(tenantA(), fn () => DB::table('ops_supplier_requests as q')->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')->join('booking_reservation_services as s', 's.id', '=', 'q.reservation_service_id')->where('s.status', '<>', 'cancelado')->where('p.email', 'like', '%@%')->whereNull('q.deleted_at')->value('q.id'));
    expect($request)->not->toBeNull();
    withinTenant(tenantA(), fn () => DB::table('ops_supplier_requests')->where('id', $request)->update(['status' => 'solicitado', 'requested_at' => now()->subDays(2)]));

    expect(runAlertJob(new RemindPendingSupplierRequests))->toContain('recordatorio');
    runAlertJob(new RemindPendingSupplierRequests);

    expect(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'proveedor.recordatorio')->where('source_id', $request)->count()))->toBe(1);
});

it('JOB-27 marca la aprobación vencida y avisa a gerencia', function () {
    $approval = withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('status', 'pendiente')->value('id'));
    expect($approval)->not->toBeNull();
    withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('id', $approval)->update(['due_at' => now()->subHour(), 'paused_at' => null]));

    runAlertJob(new ApprovalSlaCheck);

    expect(withinTenant(tenantA(), fn () => DB::table('collab_approval_events')->where('request_id', $approval)->where('event', 'sla_vencido')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'aprobacion.sla_vencido')->where('source_id', $approval)->exists()))->toBeTrue();
});
