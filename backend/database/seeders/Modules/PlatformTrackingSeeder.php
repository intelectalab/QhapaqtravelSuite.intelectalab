<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformTrackingSeeder
{
    private const KIT_TODAY = '2026-09-29';

    private const PAGES = [['/', 30], ['/lima', 22], ['/cusco', 18], ['/arequipa', 12], ['/agencias', 10], ['/tours/free-tour-centro-de-lima', 8]];

    private const BLOG_PAGES = [['/blog/free-tours-en-lima-guia', 40], ['/blog/cuanta-propina-free-tour-peru', 35], ['/blog/que-comer-en-lima-en-un-dia', 25]];

    public function __construct(private readonly ?Tenant $tenant = null) {}

    public function run(): void
    {
        if ($this->tenant !== null && $this->tenant->code !== TrackingSeeder::KIT_TENANT) {
            return;
        }

        $data = KitSeeds::read('platformTracking');
        $approver = $this->db()->table('platform_users')->orderBy('created_at')->value('id');
        $tags = [];

        foreach ($data['tags'] as $tag) {
            $active = in_array($tag['status'], ['activo', 'pausado'], true);
            $values = [
                'site' => $tag['site'],
                'provider' => $tag['provider'],
                'name' => $tag['name'],
                'measurement_id' => $tag['mid'],
                'config' => json_encode(['server_side' => (bool) (($tag['config']['server'] ?? false) || ($tag['config']['capi'] ?? false))]),
                'consent_category' => $tag['consent'],
                'status' => $active && $approver === null ? 'borrador' : $tag['status'],
                'approved_by' => $active ? $approver : null,
                'approved_at' => $active && $approver ? $this->moment($tag['verifiedAt'] ?? self::KIT_TODAY) : null,
                'verified_at' => $this->moment($tag['verifiedAt'] ?? null),
                'verify_result' => ($tag['verify'] ?? null) === 'ok' ? 'ok' : null,
                'submitted_at' => $tag['status'] === 'en_revision' ? now() : null,
                'updated_at' => now(),
            ];
            $existing = $this->db()->table('platform_tracking_tags')->where('code', $tag['id'])->value('id');

            if ($existing) {
                $this->db()->table('platform_tracking_tags')->where('id', $existing)->update($values);
                $tags[$tag['id']] = (string) $existing;
            } else {
                $tags[$tag['id']] = (string) Str::uuid7();
                $this->db()->table('platform_tracking_tags')->insert(['id' => $tags[$tag['id']], 'code' => $tag['id'], ...$values, 'created_at' => now()]);
            }
        }

        foreach ($data['mappings'] as $mapping) {
            $this->db()->table('platform_conversion_mappings')->updateOrInsert(
                ['tag_id' => $tags[$mapping['tagId']], 'internal_event' => $mapping['event']],
                ['provider_event' => $mapping['providerEvent'], 'conversion_label' => $mapping['label'], 'send_value' => $mapping['value'], 'server_side' => $mapping['server'], 'active' => true, 'updated_at' => now()],
            );
        }

        $this->db()->table('platform_web_analytics_daily')->delete();
        $devices = [['movil', 70], ['escritorio', 26], ['tablet', 4]];
        $countries = [['PE', 62], ['US', 10], ['AR', 6], ['CL', 6], ['ES', 5]];

        foreach (['vitrina' => self::PAGES, 'blog' => self::BLOG_PAGES] as $site => $pages) {
            foreach ($data['sites'][$site] as $day) {
                foreach (WebAnalyticsSplit::rows($day, $pages, $data['sources'], $devices, $countries) as $row) {
                    $this->db()->table('platform_web_analytics_daily')->insert(['day' => $this->day($day['d']), 'site' => $site, ...$row]);
                }
            }
        }

        $agencies = $this->db()->table('platform_showcase_agencies')->pluck('id', 'code');

        foreach ($data['agencies'] as [$code, $visits, $bookings]) {
            if (! isset($agencies[$code])) {
                continue;
            }

            foreach (array_slice($data['sites']['vitrina'], -30) as $index => $day) {
                $daily = max(1, intdiv((int) $visits, 30) + ($index % 5));
                $this->db()->table('platform_web_analytics_daily')->insert([
                    'day' => $this->day($day['d']),
                    'site' => 'vitrina',
                    'path' => '/agencias/'.Str::lower($code),
                    'agency_id' => $agencies[$code],
                    'device' => 'movil',
                    'visits' => $daily,
                    'visitors' => max(1, (int) round($daily * 0.82)),
                    'pageviews' => $daily * 2,
                    'bounces' => (int) round($daily * 0.35),
                    'conversions' => (int) round($bookings / 30),
                ]);
            }
        }
    }

    private function day(string $date): string
    {
        return Carbon::parse($date)->addDays((int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today('America/Lima'), false))->toDateString();
    }

    private function moment(?string $value): ?string
    {
        return $value ? Carbon::parse($value, 'America/Lima')->addDays((int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today('America/Lima'), false))->toIso8601String() : null;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
