<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ExternalReviewDirectory
{
    public const PROVIDERS = ['google' => 'Google', 'tripadvisor' => 'TripAdvisor', 'trustpilot' => 'Trustpilot', 'facebook' => 'Facebook', 'getyourguide' => 'GetYourGuide', 'viator' => 'Viator'];

    public const LAYOUTS = ['lista', 'cuadricula'];

    public function overview(User $viewer): array
    {
        $sources = DB::table('integration_review_sources as s')->leftJoin('iam_users as u', 'u.id', '=', 's.connected_by')->get(['s.*', 'u.name as connected_by_name'])->keyBy('id');
        $rows = DB::table('channel_external_reviews as e')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'e.product_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'e.replied_by')
            ->orderByDesc('e.review_date')
            ->get(['e.*', 'p.code as product_code', 'p.name as product_name', 'u.name as replied_by_name']);
        $connected = $sources->where('status', 'conectado')->filter(fn (object $source): bool => $source->rating !== null);
        $weight = $connected->sum('review_count');

        return [
            'kpis' => [
                'average' => $weight > 0 ? round($connected->sum(fn (object $source): float => (float) $source->rating * $source->review_count) / $weight, 2) : null,
                'total' => (int) $weight,
                'connected' => $sources->where('status', 'conectado')->count(),
                'inbox' => $rows->count(),
                'unanswered' => $rows->where('response_status', 'sin_responder')->count(),
                'critical' => $rows->where('response_status', 'sin_responder')->where('rating', '<=', 3)->count(),
            ],
            'sources' => collect(self::PROVIDERS)->map(function (string $label, string $provider) use ($sources, $rows): array {
                $source = $sources->firstWhere('provider', $provider);

                return [
                    'provider' => $provider,
                    'label' => $label,
                    'status' => $source->status ?? 'no_conectado',
                    'rating' => $source && $source->rating !== null ? (float) $source->rating : null,
                    'count' => (int) ($source->review_count ?? 0),
                    'account' => $source->account_ref ?? null,
                    'key_last4' => $source->secret_last4 ?? null,
                    'scopes' => $source ? array_values(array_filter(explode(',', trim((string) $source->scopes, '{}')), fn (string $scope): bool => $scope !== '')) : [],
                    'can_reply' => (bool) ($source->can_reply ?? false),
                    'invites' => (bool) ($source->supports_invites ?? false),
                    'last_sync_at' => $source->last_sync_at ?? null,
                    'connected_at' => $source->connected_at ?? null,
                    'connected_by' => $source->connected_by_name ?? null,
                    'inbox' => $source ? $rows->where('source_id', $source->id)->count() : 0,
                ];
            })->values(),
            'items' => $rows->map(function (object $row) use ($sources): array {
                $source = $sources->get($row->source_id);

                return [
                    'id' => $row->id,
                    'code' => $row->external_id,
                    'provider' => $source?->provider,
                    'source' => self::PROVIDERS[$source?->provider] ?? $source?->provider,
                    'can_reply' => (bool) ($source->can_reply ?? false),
                    'author' => $row->author_display,
                    'date' => $row->review_date,
                    'rating' => (int) $row->rating,
                    'title' => $row->title,
                    'body' => $row->body,
                    'lang' => $row->lang,
                    'product' => $row->product_code ? ['code' => $row->product_code, 'name' => $row->product_name] : null,
                    'url' => $row->url,
                    'status' => $row->response_status,
                    'reply' => $row->reply,
                    'replied_at' => $row->replied_at,
                    'replied_by' => $row->replied_by_name,
                ];
            })->values(),
            'can_reply' => $viewer->can('channels.ecommerce.manage') || $viewer->can('crm.clients.manage'),
            'widget' => $this->widget($sources->where('status', 'conectado')->pluck('provider')->values()->all()),
            'can_configure' => $viewer->can('channels.ecommerce.manage'),
        ];
    }

    public static function widgetSettings(array $defaults, array $connected): array
    {
        $stored = (array) ($defaults['reviews_widget'] ?? []);
        $sources = array_values(array_filter((array) ($stored['sources'] ?? $connected), fn (mixed $provider): bool => is_string($provider) && isset(self::PROVIDERS[$provider])));

        return [
            'sources' => $sources,
            'min_rating' => (int) ($stored['min_rating'] ?? 4),
            'count' => (int) ($stored['count'] ?? 3),
            'layout' => in_array($stored['layout'] ?? null, self::LAYOUTS, true) ? $stored['layout'] : 'lista',
        ];
    }

    private function widget(array $connected): ?array
    {
        $config = DB::table('channel_widget_config')->first(['tenant_slug', 'public_key', 'defaults']);

        if ($config === null) {
            return null;
        }

        $defaults = json_decode((string) $config->defaults, true) ?: [];

        return [
            'tenant_slug' => $config->tenant_slug,
            'public_key' => $config->public_key,
            'cdn' => $defaults['cdn'] ?? null,
            'settings' => self::widgetSettings($defaults, $connected),
        ];
    }
}
