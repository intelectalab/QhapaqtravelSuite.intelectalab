<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CrmCatalog
{
    public const KINDS = ['lead_source', 'lead_channel', 'lead_interest', 'client_segment', 'activity_type', 'discard_reason', 'lost_reason'];

    private ?Collection $items = null;

    public function label(string $kind, ?string $code): ?string
    {
        return $code === null ? null : ($this->items()->get($kind)?->firstWhere('code', $code)['label'] ?? $code);
    }

    public function has(string $kind, string $code): bool
    {
        return $this->items()->get($kind)?->contains('code', $code) ?? false;
    }

    public function options(): Collection
    {
        return $this->items()->map(fn (Collection $items) => $items->values());
    }

    private function items(): Collection
    {
        return $this->items ??= DB::table('crm_catalog_items')->where('is_active', true)->orderBy('sort_order')->get(['kind', 'code', 'label', 'requires_detail'])
            ->map(fn (object $item) => ['kind' => $item->kind, 'code' => $item->code, 'label' => $item->label, 'requires_detail' => (bool) $item->requires_detail])
            ->groupBy('kind');
    }
}
