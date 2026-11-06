<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class FxRatesSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $rows = collect(KitSeeds::read('settings')['fxHistory'] ?? [])
            ->map(fn (array $seed): array => ['code' => 'USD', 'rate' => $seed['fx'], 'at' => $seed['date'].' 08:00', 'source' => $seed['source'], 'by' => $seed['user'] ?? null])
            ->merge(collect(KitSeeds::read('fxRateHistory'))->map(fn (array $seed): array => ['code' => $seed['code'], 'rate' => $seed['rate'], 'at' => $seed['at'], 'source' => $seed['source'], 'by' => $seed['by']]))
            ->sortBy('at')
            ->values();
        $previous = [];

        foreach ($rows as $row) {
            $date = $this->day(substr($row['at'], 0, 10));
            $code = $row['code'];
            $exists = DB::table('fin_fx_rates')->where('tenant_id', $this->tenant->getKey())->where('currency_code', $code)->where('rate_date', $date)->exists();

            if (! $exists && $date <= Carbon::today()->toDateString()) {
                DB::table('fin_fx_rates')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->tenant->getKey(),
                    'currency_code' => $code,
                    'base_currency' => 'PEN',
                    'rate_pen' => $row['rate'],
                    'previous_rate' => $previous[$code] ?? null,
                    'rate_date' => $date,
                    'source' => $row['source'],
                    'effective_at' => $this->moment($row['at']),
                    'created_by' => str_starts_with((string) $row['by'], 'U') ? $this->userId($row['by']) : null,
                ]);
            }

            $previous[$code] = $row['rate'];
        }
    }
}
