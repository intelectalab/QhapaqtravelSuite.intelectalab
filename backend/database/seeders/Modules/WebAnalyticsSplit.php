<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

final class WebAnalyticsSplit
{
    public static function rows(array $day, array $pages, array $sources, array $devices, array $countries): array
    {
        $rows = [];
        $count = count($pages);

        foreach ($pages as $index => $page) {
            $share = (float) $page[count($page) - 1] / 100;
            $visits = max(1, (int) round($day['visits'] * $share));
            $source = $sources[$index % count($sources)];
            $device = $devices[$index % count($devices)][0];
            $country = $countries[$index % count($countries)][0];
            $rows[] = [
                'path' => $page[0],
                'source' => $source[0],
                'medium' => $source[1],
                'campaign' => $source[2],
                'device' => $device,
                'country' => $country,
                'visits' => $visits,
                'visitors' => min($visits, max(1, (int) round($day['visitors'] * $share))),
                'pageviews' => max($visits, (int) round($day['pageviews'] * $share)),
                'bounces' => min($visits, (int) round($day['bounces'] * $share)),
                'engaged_seconds' => (int) round($day['engaged'] * $share),
                'conversions' => $index === 0 ? (int) $day['conv'] : 0,
                'revenue' => $index === 0 ? number_format((float) $day['rev'], 2, '.', '') : '0.00',
            ];
        }

        return $count === 0 ? [] : $rows;
    }
}
