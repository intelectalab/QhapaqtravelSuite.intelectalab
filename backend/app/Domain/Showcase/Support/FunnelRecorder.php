<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

final class FunnelRecorder
{
    public const KINDS = ['visita', 'reserva', 'registro_agencia', 'pase_iniciado', 'plan_pagado', 'addon_comprado'];

    public function record(string $kind, ?string $agencyId = null, ?string $tenantId = null, ?string $listingId = null, ?array $utm = null): void
    {
        DB::connection('pgsql_platform')->table('platform_funnel_events')->insert([
            'occurred_at' => now(),
            'kind' => $kind,
            'agency_id' => $agencyId,
            'tenant_id' => $tenantId,
            'listing_id' => $listingId,
            'session_hash' => hash('sha256', (string) Request::ip().'|'.(string) Request::userAgent().'|'.now()->toDateString()),
            'utm' => $utm === null || $utm === [] ? null : json_encode($utm, JSON_UNESCAPED_UNICODE),
        ]);
    }

    public static function utm(array $input): array
    {
        return array_filter(array_intersect_key($input, array_flip(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'])), fn (mixed $value): bool => is_string($value) && $value !== '');
    }
}
