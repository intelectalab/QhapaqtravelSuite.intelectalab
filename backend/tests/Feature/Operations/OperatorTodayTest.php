<?php

use App\Domain\Mobile\Support\OperatorAppPreview;
use Illuminate\Support\Facades\DB;

function guideFieldService(): object
{
    return withinTenant(tenantA(), function (): object {
        $guide = DB::table('ops_guides')->where('id', DB::table('iam_users')->where('code', 'U09')->value('guide_id'))->first(['id', 'code', 'full_name']);
        $service = DB::table('ops_assignments as a')
            ->join('booking_reservation_services as s', 's.id', '=', 'a.reservation_service_id')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->whereIn('s.service_kind', OperatorAppPreview::FIELD_KINDS)
            ->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->whereNull('r.deleted_at')
            ->where('s.status', '<>', 'cancelado')
            ->orderBy('s.code')
            ->first(['a.id', 's.id as service_id', 's.code']);
        DB::table('ops_assignments')->where('id', $service->id)->update(['guide_id' => $guide->id]);
        DB::table('booking_reservation_services')->where('id', $service->service_id)->update(['service_date' => BUSINESS_TODAY]);

        return (object) ['guide' => $guide, 'code' => $service->code];
    });
}

it('05 §7: el guía ve en la web solo su día, sin equipo, dispositivos ni sincronización', function () {
    $fixture = guideFieldService();
    actingAsSeed('U09');

    $day = $this->getJson('/api/v1/mobile/operator/today?date='.BUSINESS_TODAY)->assertOk()->json('data');

    expect($day['selected_staff']['code'])->toBe($fixture->guide->code)
        ->and($day['staff'])->toHaveCount(1)
        ->and($day)->not->toHaveKeys(['devices', 'sync'])
        ->and(collect($day['services'])->pluck('code'))->toContain($fixture->code)
        ->and(collect($day['services'])->pluck('guide')->unique()->all())->toBe([$fixture->guide->full_name]);
});

it('05 §7: el día propio es solo de la app del operador; el back-office usa la vista previa', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/mobile/operator/today'))->toBeApiError(403, 'EXPERIENCE_MISMATCH');
    $this->getJson('/api/v1/mobile/operator')->assertOk()->assertJsonStructure(['data' => ['staff', 'devices', 'sync']]);
});

it('SEC-BR-05: al guía solo se le abre su pantalla de inicio en la web', function () {
    actingAsSeed('U09');

    $access = $this->getJson('/api/v1/me/access')->assertOk()->json('data');

    expect($access['experience'])->toBe('mobile')
        ->and($access['routes'])->toBe(['/mobile/operador'])
        ->and($access['screens']['/mobile/pasajero'] ?? false)->toBeFalse();
});
