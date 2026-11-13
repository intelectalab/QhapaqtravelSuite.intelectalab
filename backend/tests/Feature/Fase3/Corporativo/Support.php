<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use Database\Seeders\Modules\CorporateAccountsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function corpAccount(): object
{
    return withinTenant(tenantA(), function (): object {
        (new CorporateAccountsSeeder(tenantA()))->run();
        $client = DB::table('crm_clients')->where('code', 'CLI-0002')->value('id');

        return DB::table('crm_corporate_accounts')->where('client_id', $client)->first();
    });
}

function corpCenter(object $account, string $code): object
{
    return withinTenant(tenantA(), fn () => DB::table('crm_corporate_cost_centers')->where('account_id', $account->id)->where('code', $code)->first());
}

function corpMember(object $account, string $email): object
{
    return withinTenant(tenantA(), fn () => DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->where('email', $email)->first());
}

function corpLogin(object $account, string $email, string $name): User
{
    return withinTenant(tenantA(), function () use ($account, $email, $name): User {
        $user = User::query()->create([
            'code' => 'UCP-'.Str::upper(Str::random(5)),
            'name' => $name,
            'email' => $email,
            'client_id' => $account->client_id,
            'sede_id' => DB::table('iam_sedes')->orderBy('created_at')->value('id'),
            'status' => 'activo',
            'password' => 'Clave-de-prueba-2026',
            'mfa_enabled' => false,
            'mfa_required' => false,
        ]);
        $user->syncRoles([Role::query()->where('name', 'customer')->firstOrFail()]);
        DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->where('email', $email)->update(['user_id' => $user->getKey(), 'status' => 'activo', 'accepted_at' => now()]);

        return $user;
    });
}

function corpPendingApproval(object $account, string $centerCode, string $code, string $reservationCode = 'RES-2026-000348', string $amount = '7420.00'): object
{
    return withinTenant(tenantA(), function () use ($account, $centerCode, $code, $reservationCode, $amount): object {
        $center = DB::table('crm_corporate_cost_centers')->where('account_id', $account->id)->where('code', $centerCode)->value('id');
        $reservation = DB::table('booking_reservations')->where('code', $reservationCode)->value('id');
        DB::table('booking_corporate_approvals')->where('reservation_id', $reservation)->where('status', 'pendiente')->update(['status' => 'cancelada']);
        DB::table('booking_corporate_approvals')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => tenantA()->getKey(),
            'code' => $code,
            'account_id' => $account->id,
            'reservation_id' => $reservation,
            'cost_center_id' => $center,
            'amount' => $amount,
            'currency' => 'PEN',
            'requested_by_user_id' => DB::table('iam_users')->where('code', 'U03')->value('id'),
            'status' => 'pendiente',
            'expires_at' => now()->addHours(72),
        ]);

        return DB::table('booking_corporate_approvals')->where('code', $code)->first();
    });
}

function corpRule(bool $enabled): void
{
    withinTenant(tenantA(), function () use ($enabled): void {
        DB::table('sys_booking_rules')->where('code', 'R-CORP-PORTAL')->update(['enabled' => $enabled]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

function corpAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}
