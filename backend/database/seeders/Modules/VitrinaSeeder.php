<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Showcase\Support\GatewayFees;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\SeoAuditor;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class VitrinaSeeder
{
    use SeedsTenant;

    public const ORDER = 90;

    private const PROVIDERS = ['Pasarela local (tarjetas)' => 'pasarela_local', 'PayPal' => 'paypal', 'Yape / Plin (QR)' => 'yape'];

    private const CHANNELS = ['Portal cliente' => 'portal', 'Correo firmado' => 'correo_firmado', 'WhatsApp' => 'whatsapp', 'Presencial' => 'presencial'];

    private const NAME_MODES = ['solo nombre' => 'solo_nombre', 'nombre completo' => 'nombre_completo'];

    private const RUCS = ['SHA-03' => '20612345671', 'SHA-04' => '20601234562', 'SHA-05' => '10456789013', 'SHA-06' => '20609876544'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        if ($this->tenant->code === 'TNT-0001') {
            $this->gateways();
            $this->domains();
            $this->seoPages();
            $this->redirects();
            $this->stories();
            $this->addons();
            $this->showcase();
        }

        $this->linkAgency();
        $this->passes();
    }

    private function linkAgency(): void
    {
        $seed = collect(KitSeeds::read('showcase')['agencies'])->firstWhere('tenantId', $this->tenant->code);

        if ($seed === null) {
            return;
        }

        $this->platform()->table('platform_showcase_agencies')->where('code', $seed['id'])->update(['tenant_id' => $this->tenant->getKey(), 'email' => (string) $this->tenant->admin_email, 'ruc' => null, 'license_ref' => null]);
    }

    private function gateways(): void
    {
        $ids = [];

        foreach (KitSeeds::read('gateways') as $seed) {
            $provider = self::PROVIDERS[$seed['provider']] ?? 'otro';
            $ids[$seed['id']] = $this->upsert('fin_gateway_accounts', ['provider' => $provider, 'account_ref' => $seed['account']], [
                'label' => $seed['provider'],
                'status' => $seed['status'] === 'activo' ? 'activa' : 'pendiente',
                'mode' => str_starts_with((string) $seed['mode'], 'prod') ? 'produccion' : 'sandbox',
                'currency' => $seed['currency'],
                'fee_pct' => (string) $seed['feePct'],
                'fee_fixed' => (string) $seed['feeFixed'],
                'fee_currency' => $seed['feeCurrency'],
                'fx_spread_pct' => (string) ($seed['fxSpreadPct'] ?? 0),
                'tax_on_fee' => (bool) $seed['taxOnFee'],
                'settle_days' => (int) $seed['settleDays'],
                'pass_fee_to_customer' => (bool) $seed['passFee'],
                'credentials_ref' => 'vault://gateways/demo/'.strtolower($seed['id']),
                'addon_required' => $provider === 'paypal' ? 'paypal_gateway' : null,
                'created_by' => $this->userId('U07'),
            ]);
        }

        foreach (KitSeeds::read('gatewayTxns') as $seed) {
            $payment = DB::table('fin_payments')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['paymentId'])->first(['id', 'currency']);

            if ($payment === null || ! isset($ids[$seed['gatewayId']])) {
                continue;
            }

            $totals = GatewayFees::totals(Decimal::money($seed['gross']), Decimal::money($seed['fee']), Decimal::money($seed['tax']), Decimal::money(0));
            $this->upsert('fin_payment_fees', ['payment_id' => $payment->id], [
                ...$totals,
                'gateway_account_id' => $ids[$seed['gatewayId']],
                'currency' => $seed['currency'],
                'status' => $seed['status'],
                'external_ref' => $seed['ref'],
                'settled_on' => $seed['status'] === 'estimado' ? null : $this->day($seed['date']),
                'created_at' => $this->moment($seed['date'].' 12:00'),
            ]);
        }
    }

    private function domains(): void
    {
        foreach (KitSeeds::read('siteDomains') as $seed) {
            if (DB::table('cms_site_domains')->where('host', $seed['host'])->where('status', '<>', 'retirado')->where('tenant_id', '<>', $this->tenant->getKey())->exists()) {
                continue;
            }

            preg_match('/kipu-verify=([a-z0-9-]+)/', (string) $seed['dns'], $token);
            $verified = $seed['status'] === 'verificado';
            $this->upsert('cms_site_domains', ['host' => $seed['host']], [
                'purpose' => $seed['kind'],
                'status' => $seed['status'],
                'verify_token' => $token[1] ?? substr(hash('sha256', $seed['host']), 0, 24),
                'ssl_status' => $seed['ssl'],
                'ssl_expires_at' => $seed['sslUntil'] ? $this->moment($seed['sslUntil'].' 00:00') : null,
                'verified_at' => $verified ? $this->moment($seed['verifiedAt'].' 09:00') : null,
                'last_check_at' => $this->moment(self::KIT_TODAY.' 08:00'),
                'created_by' => $this->userId('U01'),
            ]);
        }
    }

    private function seoPages(): void
    {
        foreach (KitSeeds::read('seoPages') as $seed) {
            $page = [
                'title' => $seed['title'],
                'meta_description' => $seed['desc'] !== '' ? $seed['desc'] : null,
                'focus_keyword' => $seed['keyword'] !== '' ? $seed['keyword'] : null,
                'schema_types' => array_values(array_filter(array_map('trim', explode(',', (string) $seed['schema'])))),
                'canonical_url' => $seed['canonical'] ? $seed['path'] : null,
                'indexable' => (bool) $seed['indexable'],
                'h1_count' => (int) $seed['h1'],
                'word_count' => (int) $seed['words'],
                'images' => (int) $seed['images'],
                'images_with_alt' => (int) $seed['alt'],
                'speed_mobile' => (int) $seed['speed'],
            ];
            $audit = SeoAuditor::audit($page);
            $this->upsert('cms_seo_pages', ['path' => $seed['path']], [
                ...$page,
                'schema_types' => PgArray::literal($page['schema_types']),
                'score' => $audit['score'],
                'issues' => json_encode($audit['issues'], JSON_UNESCAPED_UNICODE),
                'clicks_28d' => (int) $seed['clicks'],
                'avg_position' => (string) $seed['position'],
                'audited_at' => $this->moment(self::KIT_TODAY.' 02:00'),
            ]);
        }
    }

    private function redirects(): void
    {
        foreach (KitSeeds::read('redirects') as $seed) {
            $this->upsert('cms_redirects', ['from_path' => $seed['from'], 'active' => true], ['to_path' => $seed['to'], 'code' => (int) $seed['code'], 'hits' => (int) $seed['hits'], 'created_by' => $this->userId('U02')]);
        }
    }

    private function stories(): void
    {
        foreach (KitSeeds::read('travelStories') as $seed) {
            $client = $this->idByCode('crm_clients', $seed['clientId']);

            if ($client === null) {
                continue;
            }

            $consent = $seed['consent'];
            $productCode = $seed['linkedProduct'] ? collect(KitSeeds::read('products'))->firstWhere('id', $seed['linkedProduct'])['code'] ?? null : null;
            $this->upsert('cms_travel_stories', ['slug' => $seed['slug']], [
                'title' => $seed['title'],
                'client_id' => $client,
                'reservation_id' => $this->idByCode('booking_reservations', $seed['resId']),
                'product_id' => $this->idByCode('catalog_products', $productCode),
                'city' => $seed['city'],
                'quote' => $seed['quote'],
                'body' => $seed['quote'],
                'photo_count' => (int) $seed['photos'],
                'status' => $seed['status'],
                'consent_at' => $consent ? $this->moment($consent['at']) : null,
                'consent_by_name' => $consent['by'] ?? null,
                'consent_channel' => $consent ? (self::CHANNELS[$consent['channel']] ?? 'presencial') : null,
                'consent_photos' => $consent ? (bool) $consent['photos'] : null,
                'consent_name_mode' => $consent ? (self::NAME_MODES[$consent['name']] ?? 'anonimo') : null,
                'published_at' => $seed['publishedAt'] ? $this->moment($seed['publishedAt'].' 10:00') : null,
                'seo_score' => (int) $seed['seoScore'],
                'views' => (int) $seed['views'],
                'created_by' => $this->userId('U02'),
            ]);
        }
    }

    private function addons(): void
    {
        foreach (KitSeeds::read('addonCatalogV28') as $seed) {
            $values = [
                'label' => $seed['label'],
                'billing_mode' => $seed['billing'],
                'price_once' => $seed['price'] === null ? null : (string) $seed['price'],
                'price_month' => $seed['priceMonth'] === null ? ($seed['billing'] === 'unico' ? null : '0') : (string) $seed['priceMonth'],
                'updated_at' => now(),
            ];

            if ($this->platform()->table('addons')->where('code', $seed['key'])->exists()) {
                $this->platform()->table('addons')->where('code', $seed['key'])->update($values);
            } else {
                $this->platform()->table('addons')->insert(['code' => $seed['key'], 'unit' => 'cuenta', ...$values]);
            }
        }
    }

    private function showcase(): void
    {
        $data = KitSeeds::read('showcase');
        $db = $this->platform();
        $agencies = [];
        $listings = [];
        $tenants = $db->table('tenants')->pluck('id', 'code');

        foreach ($data['agencies'] as $seed) {
            $tenantId = $seed['tenantId'] ? ($tenants[$seed['tenantId']] ?? null) : null;
            $slug = Str::slug($seed['name']);
            $values = [
                'code' => $seed['id'],
                'tenant_id' => $tenantId,
                'name' => $seed['name'],
                'city' => $seed['city'],
                'ruc' => $tenantId ? null : (self::RUCS[$seed['id']] ?? null),
                'email' => $tenantId ? (string) $db->table('tenants')->where('id', $tenantId)->value('admin_email') : 'contacto@'.$slug.'.pe',
                'license_ref' => $tenantId ? null : 'DIRCETUR-'.substr($seed['id'], 4).'-2026',
                'status' => $seed['verified'] ? 'activa' : 'en_revision',
                'verified_at' => $seed['verified'] ? $this->moment($seed['since'].' 09:00') : null,
                'rating' => (string) $seed['rating'],
                'reviews' => (int) $seed['reviews'],
                'created_at' => $this->moment($seed['since'].' 09:00'),
                'updated_at' => now(),
            ];
            $agencies[$seed['id']] = $this->platformUpsert('platform_showcase_agencies', ['slug' => $slug], $values);
        }

        foreach ($data['listings'] as $seed) {
            $paid = $seed['model'] === 'pago';
            $published = in_array($seed['status'], ['publicado', 'despublicado'], true);
            $listings[$seed['id']] = $this->platformUpsert('platform_showcase_listings', ['slug' => $seed['slug']], [
                'code' => $seed['id'],
                'agency_id' => $agencies[$seed['agencyId']],
                'title' => $seed['title'],
                'city' => $seed['city'],
                'zone' => $seed['zone'] ?? null,
                'theme' => $seed['theme'] ?? null,
                'languages' => PgArray::literal($seed['langs'] ?? ['es']),
                'start_times' => PgArray::literal($seed['times']),
                'duration_hours' => (string) $seed['hours'],
                'meeting_point' => $seed['meeting'],
                'model' => $paid ? 'pago' : 'propina',
                'price' => $paid ? (string) $seed['price'] : '0',
                'currency' => $seed['currency'] ?? 'PEN',
                'capacity' => (int) ($seed['capacity'] ?? 20),
                'highlights' => PgArray::literal($seed['highlights'] ?? []),
                'status' => $seed['status'],
                'reject_reason' => $seed['status'] === 'rechazado' ? ($seed['rejectReason'] ?? 'El punto de encuentro no es verificable. Indique una dirección o referencia pública.') : null,
                'featured_until' => ! empty($seed['featured']) ? Carbon::today('America/Lima')->addDays(30)->toDateString() : null,
                'rating' => ($seed['reviews'] ?? 0) > 0 ? (string) $seed['rating'] : null,
                'reviews' => (int) ($seed['reviews'] ?? 0),
                'published_at' => $published ? $this->moment(self::KIT_TODAY.' 09:00') : null,
                'updated_at' => now(),
            ]);
        }

        foreach ($data['bookings'] as $seed) {
            $listing = $db->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')->where('l.id', $listings[$seed['listingId']])->first(['a.tenant_id']);
            $commission = isset($seed['amount']);
            $this->platformUpsert('platform_showcase_bookings', ['code' => $seed['id']], [
                'listing_id' => $listings[$seed['listingId']],
                'service_date' => $this->day($seed['date']),
                'start_time' => $seed['time'],
                'traveler_name' => $seed['name'],
                'traveler_email' => $seed['email'],
                'pax' => (int) $seed['pax'],
                'language' => $seed['lang'],
                'status' => $seed['status'],
                'amount' => $commission ? (string) $seed['amount'] : null,
                'currency' => $seed['currency'] ?? 'PEN',
                'commission_pct' => $commission ? (string) $seed['commissionPct'] : null,
                'fee_amount' => (string) ($seed['fee'] ?? 0),
                'fee_basis' => $commission ? 'comision' : ($listing?->tenant_id ? 'plan' : ((float) ($seed['fee'] ?? 0) > 0 ? 'por_asistente' : 'cupo_gratis')),
                'source' => $seed['source'] ?? null,
                'cancel_token' => substr(hash('sha256', 'vitrina|'.$seed['id']), 0, 40),
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => now(),
            ]);
        }

        foreach ($data['posts'] as $seed) {
            $linked = $db->table('platform_showcase_listings')->where('status', 'publicado')->when($seed['city'], fn ($q) => $q->where('city', $seed['city']))->orderBy('code')->limit(3)->pluck('id')->all();
            $this->platformUpsert('platform_blog_posts', ['slug' => $seed['slug']], [
                'title' => $seed['title'],
                'excerpt' => $seed['excerpt'],
                'city' => $seed['city'],
                'focus_keyword' => $seed['keyword'],
                'status' => $seed['status'],
                'word_count' => (int) $seed['words'],
                'seo_score' => (int) $seed['seoScore'],
                'published_at' => $seed['publishedAt'] ? $this->moment($seed['publishedAt'].' 09:00') : null,
                'linked_listing_ids' => PgArray::literal($linked),
                'updated_at' => now(),
            ]);
        }

        if ($db->table('platform_funnel_events')->exists()) {
            return;
        }

        $kinds = ['visits' => 'visita', 'bookings' => 'reserva', 'agencies' => 'registro_agencia', 'trials' => 'pase_iniciado', 'paid' => 'plan_pagado'];

        foreach ($data['funnel'] as $month) {
            $start = Carbon::parse($month['month'].'-01 09:00', 'America/Lima')->addDays($this->shift())->startOfMonth()->utc();

            foreach ($kinds as $key => $kind) {
                $total = (int) $month[$key];

                if ($total > 0) {
                    $db->statement("insert into platform_funnel_events (occurred_at, kind, session_hash) select ?::timestamptz + ((g % 27) * interval '1 day') + ((g % 13) * interval '1 hour'), ?, encode(sha256(convert_to(? || g::text, 'UTF8')), 'hex') from generate_series(1, ?) g", [$start->toIso8601String(), $kind, $month['month'].$kind, $total]);
                }
            }
        }
    }

    private function passes(): void
    {
        $db = $this->platform();
        $features = $db->table('features')->pluck('key')->flip();
        $plans = $db->table('plans')->pluck('id', 'name');
        $creator = $db->table('platform_users')->orderBy('created_at')->value('id');

        foreach (KitSeeds::read('accessPasses') as $seed) {
            if ($seed['tenantId'] !== $this->tenant->code) {
                continue;
            }

            $tenantId = (string) $this->tenant->getKey();

            $keys = array_values(array_filter(array_map(fn (string $key) => 'module.'.$key, $seed['features']), fn (string $key) => $features->has($key)));
            $this->platformUpsert('platform_access_passes', ['code' => $seed['id']], [
                'tenant_id' => $tenantId,
                'name' => $seed['name'],
                'starts_on' => $this->day($seed['from']),
                'ends_on' => $this->day($seed['to']),
                'price' => '0',
                'currency' => $seed['currency'],
                'features' => PgArray::literal($keys ?: ['module.crm']),
                'reason' => $seed['reason'],
                'status' => $seed['status'],
                'convert_to_plan_id' => $plans[$seed['convertTo']] ?? null,
                'source' => str_contains((string) $seed['reason'], 'vitrina') ? 'vitrina' : 'consola',
                'created_by' => $creator,
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => now(),
            ]);

            if ($seed['status'] !== 'activo') {
                continue;
            }

            foreach ($keys as $key) {
                if (! $db->table('feature_overrides')->where('tenant_id', $tenantId)->where('feature_key', $key)->exists()) {
                    $db->table('feature_overrides')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $tenantId, 'feature_key' => $key, 'value' => true, 'reason' => 'Pase '.$seed['id'], 'valid_until' => $this->day($seed['to']), 'granted_by' => $creator, 'created_by' => $creator, 'created_at' => now()]);
                }
            }
        }
    }

    private function platformUpsert(string $table, array $key, array $values): string
    {
        $db = $this->platform();
        $existing = $db->table($table)->where($key)->value('id');

        if ($existing) {
            $db->table($table)->where('id', $existing)->update($values);

            return (string) $existing;
        }

        $id = (string) Str::uuid7();
        $db->table($table)->insert(['id' => $id, ...$key, ...$values]);

        return $id;
    }

    private function platform(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
