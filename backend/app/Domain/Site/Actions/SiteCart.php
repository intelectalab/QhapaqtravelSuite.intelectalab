<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;
use Throwable;

final class SiteCart
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly SiteQuote $quotes,
        private readonly SiteProfile $profile,
    ) {}

    public function find(?string $token): ?stdClass
    {
        if ($token === null || strlen($token) < 32) {
            return null;
        }

        return DB::table('channel_web_carts')->where('token_hash', hash('sha256', $token))->where('status', 'activo')->first();
    }

    public function show(?string $token): array
    {
        $cart = $this->find($token);

        return $cart ? $this->present($cart) : ['code' => null, 'items' => [], 'totals' => [], 'hold_minutes' => $this->profile->holdMinutes()];
    }

    public function add(?string $token, array $data): array
    {
        $product = $this->quotes->product($data['product']);
        $quote = $this->quotes->quote($product, $data['date'], (int) $data['adults'], (int) ($data['children'] ?? 0), (int) ($data['infants'] ?? 0), $data['promo'] ?? null);
        $cart = $this->find($token);

        if ($cart === null) {
            $token = Str::random(48);
            $cartId = (string) Str::uuid7();
            DB::table('channel_web_carts')->insert([
                'id' => $cartId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $this->codes->next('channel_web_carts', 'CART-', 5),
                'token_hash' => hash('sha256', $token),
                'currency' => $quote['currency'],
                'locale' => 'es',
                'status' => 'activo',
                'promo_code' => isset($data['promo']) ? strtoupper(trim($data['promo'])) : null,
            ]);
            $cart = DB::table('channel_web_carts')->where('id', $cartId)->first();
        }

        $line = (int) DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->max('line_no') + 1;
        $itemId = (string) Str::uuid7();
        DB::table('channel_web_cart_items')->insert([
            'id' => $itemId,
            'tenant_id' => $this->context->idOrFail(),
            'cart_id' => $cart->id,
            'line_no' => $line,
            'product_id' => $product->id,
            'service_date' => $data['date'],
            'departure_id' => $this->departureId($product->id, $data['date']),
            'pax_adults' => (int) $data['adults'],
            'pax_children' => (int) ($data['children'] ?? 0),
            'pax_infants' => (int) ($data['infants'] ?? 0),
            'source' => 'sitio',
        ]);

        if (isset($data['promo']) && trim($data['promo']) !== '') {
            DB::table('channel_web_carts')->where('id', $cart->id)->update(['promo_code' => strtoupper(trim($data['promo']))]);
        }

        $this->hold($cart, DB::table('channel_web_cart_items')->where('id', $itemId)->first());
        DB::table('channel_web_carts')->where('id', $cart->id)->update(['last_activity_at' => now()]);

        return ['token' => $token, 'cart' => $this->present(DB::table('channel_web_carts')->where('id', $cart->id)->first())];
    }

    public function remove(?string $token, int $line): array
    {
        $cart = $this->find($token) ?? throw ApiException::notFound('Tu carrito expiró o ya fue procesado.');
        $item = DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->where('line_no', $line)->first() ?? throw ApiException::notFound('Esa línea ya no está en tu carrito.');
        $this->release($item, 'El cliente quitó la línea del carrito');
        DB::table('channel_web_cart_items')->where('id', $item->id)->delete();
        DB::table('channel_web_carts')->where('id', $cart->id)->update(['last_activity_at' => now()]);

        return $this->present($cart);
    }

    public function promo(?string $token, ?string $code): array
    {
        $cart = $this->find($token) ?? throw ApiException::notFound('Tu carrito expiró o ya fue procesado.');
        $code = $code === null ? null : strtoupper(trim($code));

        if ($code !== null) {
            $today = Carbon::now($this->context->timezone())->toDateString();
            $valid = DB::table('catalog_product_promotions')->where('promo_code', $code)->whereNull('deleted_at')->where('status', 'activa')
                ->whereIn('channel', ['Todos', 'E-commerce'])->where('date_from', '<=', $today)->where('date_to', '>=', $today)
                ->whereIn('product_id', DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->select('product_id'))
                ->exists();

            if (! $valid) {
                throw ApiException::unprocessable('SIT-BR-08', 'Ese código no aplica a los tours de tu carrito o ya no está vigente.', ['code' => ['Ese código no aplica a los tours de tu carrito o ya no está vigente.']]);
            }

            DB::table('channel_web_carts')->where('id', $cart->id)->update(['promo_code' => $code, 'last_activity_at' => now()]);
            $cart->promo_code = $code;
        } else {
            DB::table('channel_web_carts')->where('id', $cart->id)->update(['promo_code' => null, 'last_activity_at' => now()]);
            $cart->promo_code = null;
        }

        return $this->present($cart);
    }

    public function rehold(?string $token, int $line): array
    {
        $cart = $this->find($token) ?? throw ApiException::notFound('Tu carrito expiró o ya fue procesado.');
        $item = DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->where('line_no', $line)->first() ?? throw ApiException::notFound('Esa línea ya no está en tu carrito.');
        $this->hold($cart, $item);

        return $this->present($cart);
    }

    public function present(stdClass $cart): array
    {
        $items = DB::table('channel_web_cart_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')
            ->leftJoin('catalog_availability_holds as h', 'h.id', '=', 'i.hold_id')
            ->where('i.cart_id', $cart->id)->orderBy('i.line_no')
            ->get(['i.*', 'p.slug', 'p.name', 'h.ref as hold_ref', 'h.status as hold_status', 'h.expires_at as hold_until']);
        $lines = $items->map(function (stdClass $item) use ($cart): array {
            $quote = null;
            $error = null;

            try {
                $quote = $this->quotes->quote($this->quotes->product($item->slug), $item->service_date, (int) $item->pax_adults, (int) $item->pax_children, (int) $item->pax_infants, $cart->promo_code);
            } catch (ApiException $e) {
                $error = $e->getMessage();
            } catch (Throwable) {
                $error = 'Este producto ya no está disponible en línea.';
            }

            $live = $item->hold_status === 'hold' && $item->hold_until !== null && Carbon::parse($item->hold_until)->isFuture();

            return [
                'line' => (int) $item->line_no,
                'product' => ['slug' => $item->slug, 'name' => $item->name],
                'date' => $item->service_date,
                'pax' => ['adults' => (int) $item->pax_adults, 'children' => (int) $item->pax_children, 'infants' => (int) $item->pax_infants],
                'quote' => $quote ? array_diff_key($quote, ['rate_id' => true]) : null,
                'error' => $error,
                'cancellation' => DB::table('catalog_product_policies')->where('product_id', $item->product_id)->value('cancellation') ?? $this->profile->show()['policies']['cancel'],
                'hold' => $item->hold_id ? ['ref' => $item->hold_ref, 'status' => $live ? 'hold' : 'expirada', 'expires_at' => Carbon::parse($item->hold_until)->toIso8601String()] : null,
            ];
        });
        $totals = $lines->filter(fn (array $l): bool => $l['quote'] !== null)->groupBy(fn (array $l): string => $l['quote']['currency'])
            ->map(fn ($group, string $currency): array => [
                'currency' => $currency,
                'subtotal' => (string) $group->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($l['quote']['subtotal']), BigDecimal::zero()->toScale(2)),
                'discount' => (string) $group->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($l['quote']['discount']['amount'] ?? '0'), BigDecimal::zero()->toScale(2)),
                'total' => (string) $group->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($l['quote']['total']), BigDecimal::zero()->toScale(2)),
            ])->values();

        return [
            'code' => $cart->code,
            'promo' => $cart->promo_code,
            'items' => $lines->all(),
            'totals' => $totals->all(),
            'hold_minutes' => $this->profile->holdMinutes(),
            'fx' => $this->profile->usdRate(),
        ];
    }

    public function hold(stdClass $cart, stdClass $item): void
    {
        $product = $this->quotes->product(DB::table('catalog_products')->where('id', $item->product_id)->value('slug'));
        $seats = (int) $item->pax_adults + (int) $item->pax_children;
        $availability = $this->quotes->catalog()->availability();
        $controlled = $availability->usesDepartures($product->id) || DB::table('catalog_availability_ranges')->where('product_id', $product->id)->whereNull('deleted_at')->exists();

        if (! $controlled) {
            return;
        }

        $this->release($item, 'Renovación del bloqueo del carrito');

        if ($item->departure_id) {
            DB::table('catalog_product_departures')->where('id', $item->departure_id)->lock('for no key update')->first();
        }

        $live = DB::table('catalog_availability_holds')->where('status', 'hold')->where('expires_at', '>', now())
            ->when($item->departure_id, fn ($q) => $q->where('departure_id', $item->departure_id), fn ($q) => $q->where('product_id', $product->id)->where('service_date', $item->service_date))
            ->sum('quantity');
        $day = $availability->day($product, $item->service_date, 1, $this->profile->today());
        $free = $item->departure_id
            ? (int) DB::table('catalog_product_departures')->where('id', $item->departure_id)->selectRaw('capacity - sold as free')->value('free') - (int) $live
            : ($day['spots'] ?? PHP_INT_MAX);

        if (! $availability->sellable($day) || $free < $seats) {
            throw ApiException::conflict('RT-4', 'La salida del '.Carbon::parse($item->service_date)->format('d/m/Y').' ya no tiene cupos para tu grupo. Elige otra fecha.');
        }

        $holdId = (string) Str::uuid7();
        $expires = now()->addMinutes($this->profile->holdMinutes());
        DB::table('catalog_availability_holds')->insert([
            'id' => $holdId,
            'tenant_id' => $this->context->idOrFail(),
            'ref' => $this->codes->next('catalog_availability_holds', 'HLD-', 4, 'ref'),
            'departure_id' => $item->departure_id,
            'product_id' => $item->departure_id ? null : $product->id,
            'service_date' => $item->departure_id ? null : $item->service_date,
            'quantity' => $seats,
            'reference' => $cart->code,
            'reference_type' => 'cart',
            'reference_id' => $cart->id,
            'status' => 'hold',
            'expires_at' => $expires,
            'notes' => 'Bloqueo automático del carrito del sitio web',
        ]);
        DB::table('channel_web_cart_items')->where('id', $item->id)->update(['hold_id' => $holdId, 'hold_expires_at' => $expires]);
        $this->audit->log('Disponibilidad', $cart->code, 'hold', after: "{$seats} cupos · {$item->service_date}");
    }

    public function release(stdClass $item, string $reason): void
    {
        if ($item->hold_id === null) {
            return;
        }

        DB::table('catalog_availability_holds')->where('id', $item->hold_id)->where('status', 'hold')->where('expires_at', '<=', now())->update(['status' => 'expirada', 'updated_at' => now()]);
        $updated = DB::table('catalog_availability_holds')->where('id', $item->hold_id)->where('status', 'hold')
            ->update(['status' => 'liberada', 'released_reason' => $reason, 'updated_at' => now()]);

        if ($updated > 0) {
            $this->audit->log('Disponibilidad', (string) DB::table('catalog_availability_holds')->where('id', $item->hold_id)->value('ref'), 'liberar_hold', 'hold', 'liberada');
        }
    }

    private function departureId(string $productId, string $date): ?string
    {
        return DB::table('catalog_product_departures')->where('product_id', $productId)->where('departure_date', $date)->whereNotIn('status', ['cancelada', 'cerrada'])->value('id');
    }
}
