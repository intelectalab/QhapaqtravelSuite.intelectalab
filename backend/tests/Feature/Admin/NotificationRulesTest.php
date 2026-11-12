<?php

use App\Domain\Admin\Support\NotificationRules;
use App\Domain\Admin\Support\StaffNotices;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

function ruleFor(string $event, string $timing = 'immediate', string $condition = 'always'): void
{
    DB::table('notif_event_rules')->updateOrInsert(['event_code' => $event], ['label' => $event, 'ch_email' => true, 'ch_push' => true, 'recipients' => 'Cliente', 'timing' => $timing, 'condition' => $condition]);
}

it('agrupa cada 15 minutos y respeta el horario laboral', function () {
    withinTenant(tenantA(), function (): void {
        ruleFor('prueba.agrupada', 'batch_15m');
        ruleFor('prueba.laboral', 'business_hours');
        ruleFor('prueba.inmediata');
        $rules = app(NotificationRules::class);
        $morning = CarbonImmutable::parse('2026-11-11 10:07', 'America/Lima');
        $night = CarbonImmutable::parse('2026-11-11 21:30', 'America/Lima');
        $dawn = CarbonImmutable::parse('2026-11-12 06:10', 'America/Lima');

        expect($rules->releaseAt('prueba.agrupada', $morning)?->format('H:i'))->toBe('10:15')
            ->and($rules->releaseAt('prueba.laboral', $morning))->toBeNull()
            ->and($rules->releaseAt('prueba.laboral', $night)?->format('Y-m-d H:i'))->toBe('2026-11-12 08:00')
            ->and($rules->releaseAt('prueba.laboral', $dawn)?->format('Y-m-d H:i'))->toBe('2026-11-12 08:00')
            ->and($rules->releaseAt('prueba.inmediata', $night))->toBeNull();
    });
});

it('solo envía con consentimiento de marketing o si el monto supera S/ 5 000', function () {
    withinTenant(tenantA(), function (): void {
        ruleFor('prueba.marketing', condition: 'marketing_consent');
        ruleFor('prueba.monto', condition: 'amount_gt_5000');
        $rules = app(NotificationRules::class);

        expect($rules->allows('prueba.marketing', ['marketing' => true]))->toBeTrue()
            ->and($rules->allows('prueba.marketing', ['marketing' => false]))->toBeFalse()
            ->and($rules->allows('prueba.marketing'))->toBeFalse()
            ->and($rules->allows('prueba.monto', ['amount' => '5200', 'currency' => 'PEN']))->toBeTrue()
            ->and($rules->allows('prueba.monto', ['amount' => '4999.99', 'currency' => 'PEN']))->toBeFalse()
            ->and($rules->allows('evento.sin_regla'))->toBeTrue();
    });
});

it('el correo de un evento condicionado no se encola cuando la condición no se cumple', function () {
    $sent = withinTenant(tenantA(), function (): array {
        ruleFor('prueba.monto', condition: 'amount_gt_5000');
        $notices = app(StaffNotices::class);

        return [
            $notices->email('cliente@ejemplo.pe', 'prueba.monto', 'Asunto', 'Cuerpo', 'prueba', null, 'client', ['amount' => '1200', 'currency' => 'PEN']),
            $notices->email('cliente@ejemplo.pe', 'prueba.monto', 'Asunto', 'Cuerpo', 'prueba', null, 'client', ['amount' => '8000', 'currency' => 'PEN']),
        ];
    });

    expect($sent[0])->toBeNull()->and($sent[1])->not->toBeNull();
});
