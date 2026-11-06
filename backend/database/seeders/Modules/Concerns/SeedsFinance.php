<?php

declare(strict_types=1);

namespace Database\Seeders\Modules\Concerns;

use App\Domain\Platform\Models\Tenant;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

trait SeedsFinance
{
    use SeedsTenant;

    private ?float $usdRate = null;

    private array $codeIds = [];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function usdRate(): float
    {
        return $this->usdRate ??= (float) (DB::table('fin_fx_rates')->where('tenant_id', $this->tenant->getKey())->where('currency_code', 'USD')->orderByDesc('rate_date')->value('rate_pen') ?? 3.74);
    }

    protected function fxFor(string $currency, ?float $rate = null): ?float
    {
        return $currency === 'PEN' ? null : ($rate ?? $this->usdRate());
    }

    protected function codeId(string $table, ?string $code, string $column = 'code'): ?string
    {
        if ($code === null || $code === '') {
            return null;
        }

        return $this->codeIds[$table][$column][$code] ??= $this->idByCode($table, $code, $column);
    }

    protected function actor(?string $code): ?string
    {
        return $code && str_starts_with($code, 'U') ? $this->userId($code) : null;
    }

    protected function history(string $type, string $entityId, string $status, ?string $note, ?string $userId, ?string $at): void
    {
        $exists = DB::table('fin_status_history')->where('tenant_id', $this->tenant->getKey())->where('entity_type', $type)->where('entity_id', $entityId)->where('status', $status)->exists();

        if (! $exists) {
            DB::table('fin_status_history')->insert([
                'tenant_id' => $this->tenant->getKey(),
                'entity_type' => $type,
                'entity_id' => $entityId,
                'status' => $status,
                'note' => $note,
                'user_id' => $userId,
                'created_by' => $userId,
                'created_at' => $at ?? now(),
            ]);
        }
    }
}
