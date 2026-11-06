<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class ChannelsWebSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $config = KitSeeds::read('widgetConfig');

        $this->upsert('channel_widget_config', [], [
            'tenant_slug' => $config['tenantSlug'],
            'public_key' => $config['publicKey'],
            'defaults' => json_encode([...$config['defaults'], 'cdn' => $config['cdn'], 'host' => $config['host']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'reviews_widget' => json_encode(['enabled' => (bool) ($config['defaults']['reviews'] ?? false)]),
            'created_by' => $this->userId($config['keyCreatedBy'] ?? 'U01'),
            'created_at' => $this->moment($config['keyCreatedAt'] ?? null) ?? now(),
            'updated_at' => now(),
        ]);

        foreach ($config['domains'] as $domain) {
            $this->upsert('channel_widget_domains', ['domain' => $domain['domain']], [
                'cms' => $domain['cms'],
                'status' => $domain['status'],
                'verify_token' => $domain['token'],
                'verified_at' => $this->moment($domain['verifiedAt']),
                'created_by' => $this->userId($domain['addedBy']),
                'created_at' => $this->moment($domain['addedAt']),
            ]);
        }

        foreach (KitSeeds::read('webEvents') as $event) {
            $at = $this->moment($event['ts']);
            $exists = DB::table('channel_web_events')->where('session_id', $event['session'])->where('event', $event['event'])->where('occurred_at', $at)->exists();

            if (! $exists) {
                DB::table('channel_web_events')->insert([
                    'tenant_id' => $this->tenant->getKey(),
                    'occurred_at' => $at,
                    'session_id' => $event['session'],
                    'client_id' => $this->idByCode('crm_clients', $event['clientId']),
                    'event' => $event['event'],
                    'params' => json_encode($event['params'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'locale' => $event['lang'] ?? 'es',
                    'currency' => $event['currency'] ?? 'PEN',
                ]);
            }
        }
    }
}
