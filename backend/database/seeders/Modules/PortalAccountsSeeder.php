<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class PortalAccountsSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('users') as $seed) {
            $links = array_filter([
                'client_id' => $this->idByCode('crm_clients', $seed['clientId'] ?? null),
                'agency_id' => $this->idByCode('channel_b2b_agencies', $seed['agencyId'] ?? null),
                'reservation_id' => $this->idByCode('booking_reservations', $seed['resId'] ?? null),
                'provider_id' => $this->idByCode('catalog_providers', $seed['providerId'] ?? null, 'ref'),
            ]);

            if ($links !== []) {
                DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['id'])->update($links);
            }
        }
    }
}
