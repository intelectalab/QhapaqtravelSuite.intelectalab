<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Tenant;
use Carbon\CarbonImmutable;
use Database\Support\KitSeeds;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class E2ESeeder extends Seeder
{
    public const FROZEN_TODAY = '2026-09-29';

    public const PASSWORD = 'KipuControl#E2E-2026';

    public const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('El E2ESeeder solo corre fuera de producción.');
        }

        config([
            'demo.password' => config('demo.password') ?: self::PASSWORD,
            'demo.totp_secret' => config('demo.totp_secret') ?: self::TOTP_SECRET,
        ]);

        $moment = CarbonImmutable::parse((config('demo.frozen_today') ?: self::FROZEN_TODAY).' 10:00:00', 'America/Lima');
        Carbon::setTestNow($moment);
        CarbonImmutable::setTestNow($moment);

        try {
            $this->call(DemoSeeder::class);
            $this->openTenantB();
        } finally {
            Carbon::setTestNow();
            CarbonImmutable::setTestNow();
        }
    }

    private function openTenantB(): void
    {
        $seed = collect(KitSeeds::read('tenants'))->firstWhere('id', 'TNT-0002');
        $tenant = Tenant::query()->where('code', 'TNT-0002')->first();

        if ($seed === null || $tenant === null) {
            return;
        }

        DB::transaction(function () use ($tenant, $seed): void {
            DB::select('select app_set_tenant(?::uuid)', [$tenant->getKey()]);
            DB::table('iam_users')->whereRaw('lower(email) = ?', [Str::lower($seed['adminEmail'])])
                ->update(['status' => 'activo', 'mfa_required' => false, 'mfa_enabled' => false, 'updated_at' => now()]);
        });
    }
}
