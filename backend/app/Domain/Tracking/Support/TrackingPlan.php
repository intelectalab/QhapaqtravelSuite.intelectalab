<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class TrackingPlan
{
    public const ADDON = 'marketing_pro';

    private const PLAN_NAMES = [1 => 'Starter', 2 => 'Professional', 3 => 'Enterprise'];

    private ?array $resolved = null;

    public function __construct(private readonly TenantContext $context) {}

    public function rank(): int
    {
        return $this->resolve()['rank'];
    }

    public function hasAddon(): bool
    {
        return $this->resolve()['addon'];
    }

    public function retentionDays(): int
    {
        return $this->full() ? 396 : 30;
    }

    public function full(): bool
    {
        return $this->rank() >= 2 || $this->hasAddon();
    }

    public function allows(string $provider): bool
    {
        return TrackingCatalog::provider($provider)['min_rank'] <= $this->rank() || $this->hasAddon();
    }

    public function assert(string $provider, bool $serverSide): void
    {
        $meta = TrackingCatalog::provider($provider);

        if (! $this->allows($provider)) {
            throw ApiException::unprocessable('TRACKING_PLAN_REQUIRED', "{$meta['name']} está disponible desde el plan ".self::PLAN_NAMES[$meta['min_rank']].' o con el complemento Marketing Pro.', ['field' => 'provider']);
        }

        if ($serverSide && ! $this->full()) {
            throw ApiException::unprocessable('TRACKING_PLAN_REQUIRED', 'El envío de conversiones desde el servidor está disponible desde el plan Professional o con el complemento Marketing Pro.', ['field' => 'server_side']);
        }
    }

    private function resolve(): array
    {
        if ($this->resolved !== null) {
            return $this->resolved;
        }

        $tenantId = $this->context->idOrFail();
        $db = DB::connection('pgsql_platform');
        $rank = (int) $db->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $tenantId)->value('p.rank');
        $addon = $db->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')
            ->where('s.tenant_id', $tenantId)->where('s.status', '<>', 'canceled')->where('i.addon_code', self::ADDON)
            ->where(fn ($query) => $query->whereNull('i.ends_at')->orWhere('i.ends_at', '>', now()))
            ->exists();

        return $this->resolved = ['rank' => max(1, $rank), 'addon' => $addon];
    }
}
