<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsResourcesSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        foreach (KitSeeds::read('guides') as $seed) {
            $this->upsert('ops_guides', ['code' => $seed['id']], [
                'user_id' => $seed['userId'] ? $this->userId($seed['userId']) : null,
                'provider_id' => $this->idByCode('catalog_providers', 'PRV-006', 'ref'),
                'full_name' => $seed['name'],
                'languages' => '{'.implode(',', $seed['languages']).'}',
                'license_number' => $seed['license'],
                'rating' => $seed['rating'],
                'status' => $seed['status'],
                'phone' => $seed['phone'],
                'deleted_at' => null,
            ]);
        }

        foreach (KitSeeds::read('drivers') as $seed) {
            [$class, $number] = array_pad(explode(' ', $seed['license'], 2), 2, null);
            $this->upsert('ops_drivers', ['code' => $seed['id']], [
                'user_id' => $seed['userId'] ? $this->userId($seed['userId']) : null,
                'provider_id' => $this->idByCode('catalog_providers', 'PRV-004', 'ref'),
                'full_name' => $seed['name'],
                'license_number' => $number ?? $seed['license'],
                'license_class' => $number ? $class : null,
                'license_expires_on' => $this->day($seed['expires']),
                'status' => $seed['status'],
                'phone' => $seed['phone'],
                'deleted_at' => null,
            ]);
        }

        foreach (KitSeeds::read('vehicles') as $seed) {
            $this->upsert('ops_vehicles', ['plate' => $seed['plate']], [
                'vehicle_type' => $seed['type'],
                'capacity' => $seed['capacity'],
                'provider_id' => $this->idByCode('catalog_providers', $seed['providerId'], 'ref'),
                'soat_expires_on' => $this->day($seed['soat']),
                'status' => $seed['status'],
                'deleted_at' => null,
            ]);
        }

        $this->linkUsers();
    }

    private function linkUsers(): void
    {
        foreach (['ops_guides' => 'guide_id', 'ops_drivers' => 'driver_id'] as $table => $column) {
            DB::table($table)->where('tenant_id', $this->tenant->getKey())->whereNotNull('user_id')->get(['id', 'user_id'])
                ->each(fn (object $row) => DB::table('iam_users')->where('id', $row->user_id)->update([$column => $row->id]));
        }
    }
}
