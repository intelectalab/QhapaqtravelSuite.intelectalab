<?php

use App\Domain\Finance\Actions\SyncServicePayables;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

function referencesBlocked(string $reservationCode): ?string
{
    $reservationId = (string) reservationRow($reservationCode)->id;
    config(['database.connections.pgsql_probe' => config('database.connections.pgsql_owner')]);
    $probe = DB::connection('pgsql_probe');
    $probe->beginTransaction();

    try {
        $probe->statement("select set_config('app.tenant_id', ?, true)", [(string) tenantA()->getKey()]);
        $probe->statement("set local lock_timeout = '500ms'");
        $probe->select('select id from booking_reservations where id = ? for key share', [$reservationId]);
        $probe->select('select id from booking_reservation_services where reservation_id = ? for key share', [$reservationId]);

        return null;
    } catch (QueryException $exception) {
        if ((string) $exception->getCode() === '55P03') {
            return "Otra transacción no puede insertar registros que apunten a {$reservationCode} ni a sus servicios: la acción los bloqueó con FOR UPDATE. Usa lock('for no key update').";
        }

        throw $exception;
    } finally {
        $probe->rollBack();
        DB::purge('pgsql_probe');
    }
}

function expectReferencesFree(string $reservationCode): void
{
    expect(referencesBlocked($reservationCode))->toBeNull();
}

it('el detector reconoce un bloqueo FOR UPDATE sobre la reserva', function () {
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', 'RES-2026-000347')->lockForUpdate()->first());

    expect(referencesBlocked('RES-2026-000347'))->toContain('FOR UPDATE');
});

it('confirmar una reserva no bloquea las inserciones que la referencian', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/reservations/RES-2026-000349/confirm', [], critical(reservationLock('RES-2026-000349')))->assertOk();

    expectReferencesFree('RES-2026-000349');
});

it('iniciar la operación de una reserva no bloquea las inserciones que la referencian', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', 'RES-2026-000348')->update(['travel_from' => '2026-09-30']));
    $this->postJson('/api/v1/reservations/RES-2026-000348/start-operation', [], critical(reservationLock('RES-2026-000348')))->assertOk();

    expectReferencesFree('RES-2026-000348');
});

it('solicitar, confirmar o rechazar un servicio con el proveedor no bloquea las inserciones que lo referencian', function () {
    actingAsSeed('U05');
    $this->postJson('/api/v1/reservations/RES-2026-000349/services/RS-3491/request', ['note' => 'Grupo con niños'])->assertOk();
    expectReferencesFree('RES-2026-000349');

    $this->postJson('/api/v1/reservations/RES-2026-000344/services/RS-3441/confirm', ['confirmation_code' => 'pr-7781', 'time' => '06:10'])->assertOk();
    expectReferencesFree('RES-2026-000344');

    $this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3487/reject', ['reason' => 'Sin disponibilidad (sold out)', 'detail' => 'Flota completa ese día'])->assertOk();
    expectReferencesFree('RES-2026-000348');
});

it('cancelar una reserva no bloquea las inserciones que la referencian', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/reservations/RES-2026-000350/cancel', ['reason' => 'Cambio de planes', 'detail' => 'El cliente pospone el viaje.'], critical(reservationLock('RES-2026-000350')))->assertOk();

    expectReferencesFree('RES-2026-000350');
});

it('sincronizar las cuentas por pagar no bloquea las inserciones que referencian la reserva', function () {
    withinTenant(tenantA(), fn () => app(SyncServicePayables::class)->handle((string) reservationRow('RES-2026-000347')->id));

    expectReferencesFree('RES-2026-000347');
});

it('el código no bloquea reservas, servicios ni catálogo con FOR UPDATE', function () {
    $offenders = collect(File::allFiles(app_path()))
        ->filter(fn ($file): bool => $file->getExtension() === 'php')
        ->flatMap(function ($file): array {
            $lines = file($file->getPathname()) ?: [];

            $statement = function (int $index) use ($lines): string {
                $start = $index;
                while ($start > 0 && $index - $start < 4 && ! str_ends_with(rtrim($lines[$start - 1]), ';') && ! str_ends_with(rtrim($lines[$start - 1]), '{')) {
                    $start--;
                }

                return implode('', array_slice($lines, $start, $index - $start + 1));
            };

            return collect($lines)
                ->filter(fn (string $line, int $index): bool => str_contains($line, 'lockForUpdate')
                    && preg_match("/booking_reservations'|booking_reservation_services'|catalog_products'|catalog_services'|catalog_providers'|catalog_product_departures'|Reservation::query\\(\\)|ReservationService::query\\(\\)/", $statement($index)) === 1)
                ->keys()->map(fn (int $index): string => str_replace(base_path().'/', '', $file->getPathname()).':'.($index + 1))->all();
        })
        ->values()->all();

    expect($offenders)->toBe([]);
});
