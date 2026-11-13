<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Tracking\Support\TrackingCatalog;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TrackingSeeder
{
    use SeedsTenant;

    public const KIT_TENANT = 'TNT-0001';

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        if ($this->tenant->code !== self::KIT_TENANT) {
            return;
        }

        $tags = [];

        foreach (KitSeeds::read('trackingTags') as $tag) {
            $config = (array) ($tag['config'] ?? []);
            $server = (bool) (($config['capi'] ?? false) || ($config['server'] ?? false));
            $tags[$tag['id']] = $this->upsert('mkt_tracking_tags', ['code' => $tag['id']], [
                'provider' => $tag['provider'],
                'name' => $tag['name'],
                'measurement_id' => $tag['provider'] === 'script' ? null : $tag['mid'],
                'config' => json_encode(array_filter(['server_side' => $server, 'enhanced_conversions' => $config['enhanced'] ?? null, 'send_page_view' => $config['sendPageView'] ?? null], fn ($value) => $value !== null)),
                'secret_ref' => isset($config['secret']) ? 'vault://tenant/'.$this->tenant->getKey().'/tracking/'.$tag['id'] : null,
                'consent_category' => $tag['consent'],
                'placement' => $tag['placement'],
                'page_rules' => json_encode(TrackingCatalog::rules($tag['pages'], $tag['provider'] === 'script' ? '' : $tag['exclude']), JSON_UNESCAPED_SLASHES),
                'script_src' => $tag['src'] ?? null,
                'sri_hash' => $tag['sri'] ?? null,
                'script_body' => $tag['body'] ?? null,
                'csp_domains' => '{'.implode(',', (array) ($tag['csp'] ?? [])).'}',
                'exclude_checkout' => true,
                'status' => $tag['status'],
                'created_by' => $this->userId($tag['createdBy']),
                'approved_by' => $tag['approvedBy'] ? $this->userId($tag['approvedBy']) : null,
                'approved_at' => $this->moment($tag['approvedAt'] ?? null),
                'submitted_at' => $this->moment($tag['submittedAt'] ?? null),
                'verified_at' => $this->moment($tag['verifiedAt'] ?? null),
                'verify_result' => $tag['verify'] === 'ok' ? 'ok' : null,
                'verify_note' => $tag['verify'] === 'ok' ? 'Carga correcta con cookies aceptadas.' : null,
                'updated_at' => now(),
            ]);
        }

        $mappings = [];

        foreach (KitSeeds::read('conversionMappings') as $mapping) {
            $mappings[$mapping['id']] = $this->upsert('mkt_conversion_mappings', ['tag_id' => $tags[$mapping['tagId']], 'internal_event' => $mapping['event']], [
                'provider_event' => $mapping['providerEvent'],
                'conversion_label' => $mapping['label'],
                'send_value' => $mapping['value'],
                'server_side' => $mapping['server'],
                'active' => $mapping['active'],
                'updated_at' => now(),
            ]);
        }

        foreach (KitSeeds::read('conversionDispatches') as $dispatch) {
            $event = (string) Str::uuid7();
            $orderId = $this->idByCode('channel_ecom_orders', $dispatch['ref']);
            $exists = DB::table('mkt_conversion_dispatches')->where('mapping_id', $mappings[$dispatch['mappingId']])->where('occurred_at', $this->moment($dispatch['at']))->where('channel', $dispatch['channel'])->exists();

            if (! $exists) {
                DB::table('mkt_conversion_dispatches')->insert([
                    'tenant_id' => $this->tenant->getKey(),
                    'event_id' => $event,
                    'mapping_id' => $mappings[$dispatch['mappingId']],
                    'internal_event' => $dispatch['event'],
                    'channel' => $dispatch['channel'],
                    'status' => $dispatch['status'],
                    'attempts' => $dispatch['attempts'],
                    'http_status' => $dispatch['http'],
                    'error' => $dispatch['error'] ?? null,
                    'value' => $dispatch['value'],
                    'currency' => $dispatch['currency'],
                    'order_id' => $orderId,
                    'occurred_at' => $this->moment($dispatch['at']),
                    'sent_at' => $dispatch['status'] === 'enviado' ? $this->moment($dispatch['at']) : null,
                ]);
            }
        }

        $web = KitSeeds::read('webAnalytics');
        DB::table('cms_web_analytics_daily')->where('tenant_id', $this->tenant->getKey())->delete();

        foreach ($web['days'] as $day) {
            foreach (WebAnalyticsSplit::rows($day, $web['pages'], $web['sources'], $web['devices'], $web['countries']) as $row) {
                DB::table('cms_web_analytics_daily')->insert(['tenant_id' => $this->tenant->getKey(), 'day' => $this->day($day['d']), ...$row]);
            }
        }
    }
}
