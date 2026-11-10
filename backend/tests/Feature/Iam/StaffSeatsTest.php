<?php

use App\Domain\Iam\Support\StaffSeats;
use Illuminate\Support\Facades\DB;

it('el cupo de usuarios del plan cuenta solo al personal de la agencia', function () {
    [$seats, $staff, $external] = withinTenant(tenantA(), function (): array {
        $active = fn () => DB::table('iam_users')->whereNull('deleted_at')->whereIn('status', ['activo', 'pendiente']);
        $external = $active()->where(fn ($query) => $query->whereNotNull('client_id')->orWhereNotNull('agency_id')->orWhereNotNull('provider_id')->orWhereNotNull('reservation_id'))->count();

        return [StaffSeats::count(DB::table('iam_users')), $active()->count() - $external, $external];
    });

    expect($external)->toBeGreaterThan(0)
        ->and($seats)->toBe($staff);
});
