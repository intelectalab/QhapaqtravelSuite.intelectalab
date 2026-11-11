<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Channels\Support\ExternalReviewDirectory;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteReviewWidget
{
    public const MAX_COUNT = 12;

    public function feed(?array $sources, ?int $minRating, ?int $count, ?string $layout): array
    {
        $connected = DB::table('integration_review_sources')->where('status', 'conectado')->get(['id', 'provider', 'rating', 'review_count'])->keyBy('provider');
        $defaults = json_decode((string) DB::table('channel_widget_config')->value('defaults'), true) ?: [];
        $settings = ExternalReviewDirectory::widgetSettings($defaults, $connected->keys()->all());
        $wanted = array_values(array_intersect($sources ?? $settings['sources'], $connected->keys()->all()));
        $min = max(1, min(5, $minRating ?? $settings['min_rating']));
        $limit = max(1, min(self::MAX_COUNT, $count ?? $settings['count']));

        $items = $wanted === [] ? collect() : DB::table('channel_external_reviews as e')
            ->join('integration_review_sources as s', 's.id', '=', 'e.source_id')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'e.product_id')
            ->whereIn('s.provider', $wanted)->where('e.rating', '>=', $min)
            ->orderByDesc('e.review_date')->orderByDesc('e.rating')->limit($limit)
            ->get(['e.id', 'e.author_display', 'e.review_date', 'e.rating', 'e.title', 'e.body', 'e.lang', 'e.url', 's.provider', 'p.name as product_name']);

        return [
            'settings' => [
                'sources' => $wanted,
                'min_rating' => $min,
                'count' => $limit,
                'layout' => in_array($layout, ExternalReviewDirectory::LAYOUTS, true) ? $layout : $settings['layout'],
            ],
            'sources' => array_map(fn (string $provider): array => [
                'provider' => $provider,
                'name' => ExternalReviewDirectory::PROVIDERS[$provider],
                'rating' => $connected[$provider]->rating === null ? null : round((float) $connected[$provider]->rating, 1),
                'count' => (int) $connected[$provider]->review_count,
            ], $wanted),
            'items' => $items->map(fn (stdClass $row): array => [
                'id' => $row->id,
                'author' => $row->author_display,
                'date' => (string) $row->review_date,
                'rating' => (int) $row->rating,
                'title' => $row->title,
                'body' => $row->body,
                'lang' => $row->lang,
                'url' => $row->url,
                'product' => $row->product_name,
                'source' => ['provider' => $row->provider, 'name' => ExternalReviewDirectory::PROVIDERS[$row->provider] ?? $row->provider],
            ])->values()->all(),
        ];
    }
}
