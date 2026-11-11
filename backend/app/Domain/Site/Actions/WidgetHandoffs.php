<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Channels\Support\WidgetHosts;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\SiteBooking;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class WidgetHandoffs
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly SiteQuote $quotes,
        private readonly SiteProfile $profile,
        private readonly SiteCart $carts,
    ) {}

    public function config(?string $code): array
    {
        $config = DB::table('channel_widget_config')->first(['tenant_slug', 'defaults']);
        $defaults = $config ? (array) json_decode((string) $config->defaults, true) : [];
        $products = $this->quotes->catalog()->products();
        $product = $code !== null && $code !== '' ? $products->first(fn (stdClass $row): bool => $row->code === $code || $row->slug === $code) : null;
        $subdomain = $this->profile->subdomain();

        return [
            'agency' => ['subdomain' => $subdomain, 'name' => (string) $this->context->tenant()->commercial_name],
            'product' => $product ? ['code' => $product->code, 'slug' => $product->slug, 'name' => $product->name] : null,
            'defaults' => [
                'lang' => in_array($defaults['lang'] ?? null, ['es', 'en'], true) ? $defaults['lang'] : 'es',
                'currency' => in_array($defaults['currency'] ?? null, ['PEN', 'USD'], true) ? $defaults['currency'] : 'PEN',
                'theme' => is_string($defaults['theme'] ?? null) && preg_match('/^#[0-9A-Fa-f]{6}$/', $defaults['theme']) === 1 ? $defaults['theme'] : '#0A3A73',
                'radius' => max(0, min(24, (int) ($defaults['radius'] ?? 10))),
                'reviews' => (bool) ($defaults['reviews'] ?? false),
            ],
            'products' => $products->map(fn (stdClass $row): array => ['code' => $row->code, 'slug' => $row->slug, 'name' => $row->name, 'category' => $row->category_name, 'destination' => $row->destination_name])->values()->all(),
            'domains' => DB::table('channel_widget_domains')->where('status', 'verificado')->orderBy('domain')->pluck('domain')->all(),
            'site_url' => WidgetHosts::site($subdomain),
        ];
    }

    public function start(array $data): array
    {
        $product = $this->quotes->product($this->slug($data['product']));
        $adults = (int) $data['adults'];
        $children = (int) ($data['children'] ?? 0);
        $infants = (int) ($data['infants'] ?? 0);
        $quote = $this->quotes->quote($product, $data['date'], $adults, $children, $infants, null, SiteBooking::extrasFrom($data), true, $data['payment_mode'] ?? null);
        $extras = $quote['extras'];
        $code = $this->codes->next('channel_widget_handoffs', 'WHO-', 6);
        $expires = Carbon::now()->addHours((int) config('widget.handoff_hours', 24));
        $origin = isset($data['origin']) ? mb_strtolower((string) parse_url((string) $data['origin'], PHP_URL_HOST) ?: (string) $data['origin']) : null;

        DB::table('channel_widget_handoffs')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'product_id' => $product->id,
            'service_date' => $data['date'],
            'pax' => json_encode(['adt' => $adults, 'chd' => $children, 'inf' => $infants]),
            'addons' => $extras['addons'] === [] ? null : json_encode($extras['addons'], JSON_UNESCAPED_UNICODE),
            'lodging' => $extras['lodging'] === [] ? null : json_encode($extras['lodging'], JSON_UNESCAPED_UNICODE),
            'removed' => SiteBooking::pgArray($extras['removed']),
            'payment_mode' => $quote['payment_mode'],
            'currency_display' => $data['currency'] ?? $quote['currency'],
            'fx_rate' => number_format($this->profile->usdRate(), 6, '.', ''),
            'lang' => $data['lang'] ?? 'es',
            'origin_domain' => $origin !== null && $origin !== '' ? Str::limit($origin, 250, '') : null,
            'quote_snapshot' => json_encode(['total' => $quote['total'], 'currency' => $quote['currency'], 'lines' => $quote['lines'], 'extras' => $extras], JSON_UNESCAPED_UNICODE),
            'status' => 'pendiente',
            'expires_at' => $expires,
        ]);

        $this->audit->log('Traspaso del widget', $code, 'crear', after: "{$product->name} · {$data['date']} · {$quote['currency']} {$quote['total']}");

        return [
            'code' => $code,
            'total' => $quote['total'],
            'currency' => $quote['currency'],
            'expires_at' => $expires->toIso8601String(),
            'checkout_url' => WidgetHosts::site($this->profile->subdomain()).'/carrito/widget/'.$code,
        ];
    }

    public function claim(?string $token, string $code): array
    {
        return DB::transaction(function () use ($token, $code): array {
            $handoff = DB::table('channel_widget_handoffs')->where('code', $code)->lockForUpdate()->first();

            if ($handoff === null || $handoff->status === 'expirado' || Carbon::parse($handoff->expires_at)->isPast()) {
                throw ApiException::notFound('La selección del widget venció. Elige la fecha otra vez.');
            }

            if ($handoff->status !== 'pendiente') {
                throw ApiException::conflict('WG-HANDOFF-USED', 'Esta selección ya se pasó al carrito.');
            }

            $pax = (array) json_decode((string) $handoff->pax, true);
            $slug = (string) DB::table('catalog_products')->where('id', $handoff->product_id)->value('slug');
            $extras = (array) (json_decode((string) $handoff->quote_snapshot, true)['extras'] ?? []);
            $cart = $this->carts->add($token, ['product' => $slug, 'date' => $handoff->service_date, 'adults' => (int) ($pax['adt'] ?? 1), 'children' => (int) ($pax['chd'] ?? 0), 'infants' => (int) ($pax['inf'] ?? 0), 'source' => 'widget', ...SiteBooking::extrasFrom($extras)]);
            $cartId = $this->carts->find((string) $cart['token'])?->id;

            DB::table('channel_widget_handoffs')->where('id', $handoff->id)->update(['status' => 'en_carrito', 'cart_id' => $cartId, 'updated_at' => now()]);
            $this->audit->log('Traspaso del widget', $code, 'en_carrito', 'pendiente', 'en_carrito');

            return $cart;
        });
    }

    public static function convert(string $cartId): void
    {
        DB::table('channel_widget_handoffs')->where('cart_id', $cartId)->where('status', 'en_carrito')->update(['status' => 'convertido', 'updated_at' => now()]);
    }

    public static function expire(): int
    {
        return DB::table('channel_widget_handoffs')->where('status', 'pendiente')->where('expires_at', '<=', now())->update(['status' => 'expirado', 'updated_at' => now()]);
    }

    private function slug(string $product): string
    {
        $row = $this->quotes->catalog()->products()->first(fn (stdClass $row): bool => $row->code === $product || $row->slug === $product);

        return (string) data_get($row, 'slug', $product);
    }
}
