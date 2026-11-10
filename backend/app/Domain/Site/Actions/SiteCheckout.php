<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class SiteCheckout
{
    private const DOC_TYPES = ['DNI' => 'DNI', 'CE' => 'CE', 'Pasaporte' => 'PASAPORTE'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly SiteCart $carts,
        private readonly SiteQuote $quotes,
        private readonly SiteProfile $profile,
        private readonly SubscribeNewsletter $newsletter,
        private readonly SyncServicePayables $payables,
    ) {}

    public function place(?string $token, array $data): array
    {
        $cart = $this->carts->find($token) ?? throw ApiException::notFound('Tu carrito expiró o ya fue procesado.');
        DB::table('channel_web_carts')->where('id', $cart->id)->lockForUpdate()->first();
        $items = DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->orderBy('line_no')->get();

        if ($items->isEmpty()) {
            throw ApiException::unprocessable('CART_EMPTY', 'Tu carrito está vacío.');
        }

        $now = Carbon::now($this->context->timezone());
        $today = $now->toDateString();
        $fx = $this->profile->usdRate();
        $owner = $this->owner();
        $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('id');
        $lines = $items->map(function (stdClass $item) use ($cart): array {
            $product = $this->quotes->product((string) DB::table('catalog_products')->where('id', $item->product_id)->value('slug'));
            $quote = $this->quotes->quote($product, $item->service_date, (int) $item->pax_adults, (int) $item->pax_children, (int) $item->pax_infants, $cart->promo_code);
            $hold = $item->hold_id ? DB::table('catalog_availability_holds')->where('id', $item->hold_id)->first(['status', 'expires_at']) : null;

            if ($item->hold_id && ($hold === null || $hold->status !== 'hold' || Carbon::parse($hold->expires_at)->isPast())) {
                $this->carts->hold($cart, $item);
                $item = DB::table('channel_web_cart_items')->where('id', $item->id)->first();
            }

            return ['item' => $item, 'product' => $product, 'quote' => $quote];
        });
        $currency = $lines->first()['quote']['currency'];
        $rate = number_format($fx, 6, '.', '');
        $convert = fn (string $amount, string $from): BigDecimal => Decimal::round2(Decimal::convert($amount, $from, $currency, $rate));
        $orderTotal = (string) $lines->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($convert($l['quote']['total'], $l['quote']['currency'])), BigDecimal::zero()->toScale(2));
        $discount = (string) $lines->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($convert($l['quote']['discount']['amount'] ?? '0', $l['quote']['currency'])), BigDecimal::zero()->toScale(2));
        $clientId = $this->client($data, $owner);
        $orderId = (string) Str::uuid7();
        $orderCode = $this->sequences->next('web_order');
        $accessToken = Str::random(48);
        $billing = ($data['billing_type'] ?? 'Boleta') === 'Factura'
            ? ['type' => 'Factura', 'doc_type' => 'RUC', 'doc_number' => $data['ruc'], 'name' => $data['business_name'], 'fiscal_address' => $data['fiscal_address']]
            : ['type' => 'Boleta', 'doc_type' => $data['doc_type'], 'doc_number' => Str::upper($data['doc_number']), 'name' => trim($data['name'])];
        $first = $lines->first();

        DB::table('channel_ecom_orders')->insert([
            'id' => $orderId,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $orderCode,
            'ordered_at' => $now,
            'crm_client_id' => $clientId,
            'customer_name' => trim($data['name']),
            'customer_email' => Str::lower(trim($data['email'])),
            'customer_phone' => $data['phone'],
            'customer_country' => $data['country'] ?? 'Perú',
            'product_id' => $lines->count() === 1 ? $first['product']->id : null,
            'departure_id' => $lines->count() === 1 ? $first['item']->departure_id : null,
            'service_date' => $lines->count() === 1 ? $first['item']->service_date : null,
            'pax_adults' => $lines->count() === 1 ? (int) $first['item']->pax_adults : null,
            'pax_children' => $lines->count() === 1 ? (int) $first['item']->pax_children : 0,
            'price_snapshot' => json_encode($lines->map(fn (array $l): array => ['product' => $l['product']->name, 'date' => $l['item']->service_date, 'lines' => $l['quote']['lines'], 'total' => $l['quote']['total'], 'currency' => $l['quote']['currency'], 'season' => $l['quote']['season']])->all(), JSON_UNESCAPED_UNICODE),
            'promo_code' => $cart->promo_code,
            'discount_amount' => $discount,
            'total' => $orderTotal,
            'currency' => $currency,
            'fx_rate' => $fx,
            'status' => 'pago_pendiente',
            'hold_expires_at' => $lines->map(fn (array $l): ?string => $l['item']->hold_expires_at)->filter()->min(),
            'buyer_snapshot' => json_encode(['name' => trim($data['name']), 'email' => $data['email'], 'phone' => $data['phone'], 'country' => $data['country'] ?? 'Perú', 'doc_type' => $data['doc_type'], 'doc_number' => Str::upper($data['doc_number'])], JSON_UNESCAPED_UNICODE),
            'cart_id' => $cart->id,
            'sales_channel' => 'sitio_web',
            'locale' => 'es',
            'pay_mode' => 'total',
            'deposit_pct' => 100,
            'amount_due_now' => $orderTotal,
            'billing' => json_encode($billing, JSON_UNESCAPED_UNICODE),
            'consents' => json_encode(['terms_at' => $now->toIso8601String(), 'cancellation_at' => $now->toIso8601String(), 'privacy_at' => $now->toIso8601String(), 'marketing_at' => ($data['marketing'] ?? false) ? $now->toIso8601String() : null, 'policy_version' => CaptureWebLead::POLICY_VERSION], JSON_UNESCAPED_UNICODE),
            'access_token_hash' => hash('sha256', $accessToken),
        ]);

        $reservations = [];
        $receivables = [];

        foreach ($lines->values() as $index => $line) {
            [$reservationId, $receivableId, $serviceId] = $this->reservation($line, $orderId, $orderCode, $clientId, $owner, $sede, $data, $fx, $today);
            $reservations[] = $reservationId;
            $receivables[] = $receivableId;
            $quote = $line['quote'];
            $rate = DB::table('catalog_rates')->where('id', $quote['rate_id'])->first(['cost', 'season_id']);
            $seats = (int) $line['item']->pax_adults + (int) $line['item']->pax_children;

            DB::table('channel_ecom_order_lines')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'order_id' => $orderId,
                'line_no' => $index + 1,
                'product_id' => $line['product']->id,
                'product_version' => (string) (DB::table('catalog_product_versions')->where('product_id', $line['product']->id)->orderByDesc('created_at')->value('version') ?? '1'),
                'service_date' => $line['item']->service_date,
                'departure_id' => $line['item']->departure_id,
                'pax_adults' => (int) $line['item']->pax_adults,
                'pax_children' => (int) $line['item']->pax_children,
                'pax_infants' => (int) $line['item']->pax_infants,
                'rate_id' => $quote['rate_id'],
                'season_id' => $rate?->season_id,
                'season_factor' => $quote['season']['factor'] ?? 1,
                'unit_adult' => collect($quote['lines'])->firstWhere('key', 'adults')['unit'] ?? $quote['lines'][0]['unit'],
                'unit_child' => collect($quote['lines'])->firstWhere('key', 'children')['unit'] ?? '0',
                'units' => collect($quote['lines'])->firstWhere('key', 'service')['qty'] ?? null,
                'subtotal' => $quote['subtotal'],
                'discount' => $quote['discount']['amount'] ?? '0',
                'total' => $quote['total'],
                'currency' => $quote['currency'],
                'cost_total' => (string) Decimal::round2(BigDecimal::of((string) ($rate->cost ?? '0'))->multipliedBy($seats)),
                'hold_id' => $line['item']->hold_id,
                'reservation_service_id' => $serviceId,
            ]);
        }

        DB::table('channel_ecom_orders')->where('id', $orderId)->update(['reservation_id' => $reservations[0], 'reservation_ids' => '{'.implode(',', $reservations).'}', 'receivable_id' => $receivables[0], 'cost_total' => DB::table('channel_ecom_order_lines')->where('order_id', $orderId)->sum('cost_total')]);
        DB::table('channel_web_carts')->where('id', $cart->id)->update(['status' => 'convertido', 'order_id' => $orderId, 'crm_client_id' => $clientId, 'last_activity_at' => now()]);
        DB::table('catalog_availability_holds')->whereIn('id', $lines->pluck('item.hold_id')->filter()->all())->update(['reference' => $orderCode, 'reference_type' => 'order', 'reference_id' => $orderId, 'updated_at' => now()]);

        if ($data['marketing'] ?? false) {
            $this->newsletter->handle($data['email'], $data['name']);
        }

        $this->audit->log('Pedido web', $orderCode, 'crear', after: "pago_pendiente · {$currency} {$orderTotal}");

        return ['code' => $orderCode, 'token' => $accessToken];
    }

    public function order(string $code, ?string $token): array
    {
        $order = $this->authorize($code, $token);
        $reservations = DB::table('booking_reservations')->where('ecom_order_id', $order->id)->orderBy('travel_from')->get(['id', 'code', 'status', 'title', 'travel_from', 'currency', 'total_amount']);
        $services = DB::table('booking_reservation_services')->whereIn('reservation_id', $reservations->pluck('id'))->get(['reservation_id', 'name', 'service_date', 'service_time', 'pax', 'status', 'confirmation_code']);
        $receivables = DB::table('fin_receivables')->whereIn('reservation_id', $reservations->pluck('id'))->get(['reservation_id', 'code', 'concept', 'amount', 'paid_amount', 'currency', 'status', 'due_date']);
        $vouchers = DB::table('ops_vouchers')->whereIn('reservation_id', $reservations->pluck('id'))->where('status', '<>', 'anulado')->orderBy('service_date')->get(['reservation_id', 'code', 'service_label', 'service_date', 'status']);

        return [
            'code' => $order->code,
            'status' => $order->status,
            'ordered_at' => Carbon::parse($order->ordered_at)->toIso8601String(),
            'customer' => ['name' => $order->customer_name, 'email' => $order->customer_email],
            'total' => Decimal::toApi((string) $order->total),
            'discount' => Decimal::toApi((string) $order->discount_amount),
            'currency' => $order->currency,
            'hold_expires_at' => $order->hold_expires_at ? Carbon::parse($order->hold_expires_at)->toIso8601String() : null,
            'reservations' => $reservations->map(fn (stdClass $r): array => [
                'code' => $r->code,
                'status' => $r->status,
                'title' => $r->title,
                'date' => $r->travel_from,
                'total' => Decimal::toApi((string) $r->total_amount),
                'currency' => $r->currency,
                'services' => $services->where('reservation_id', $r->id)->map(fn (stdClass $s): array => ['name' => $s->name, 'date' => $s->service_date, 'time' => $s->service_time ? substr((string) $s->service_time, 0, 5) : null, 'pax' => (int) $s->pax, 'status' => $s->status, 'confirmation' => $s->confirmation_code])->values()->all(),
                'receivables' => $receivables->where('reservation_id', $r->id)->map(fn (stdClass $c): array => ['code' => $c->code, 'concept' => $c->concept, 'amount' => Decimal::toApi((string) $c->amount), 'paid' => Decimal::toApi((string) $c->paid_amount), 'currency' => $c->currency, 'status' => $c->status, 'due_date' => $c->due_date])->values()->all(),
                'vouchers' => $vouchers->where('reservation_id', $r->id)->map(fn (stdClass $v): array => ['code' => $v->code, 'label' => $v->service_label, 'date' => $v->service_date, 'status' => $v->status])->values()->all(),
            ])->all(),
        ];
    }

    public function simulatePayment(string $code, ?string $token): array
    {
        $order = $this->authorize($code, $token, true);

        if ($order->status !== 'pago_pendiente') {
            throw ApiException::conflict('ORDER_STATE', 'Este pedido ya no tiene un pago pendiente.');
        }

        $now = Carbon::now($this->context->timezone());
        $reservations = DB::table('booking_reservations')->where('ecom_order_id', $order->id)->get(['id', 'code', 'currency', 'fx_rate']);

        foreach ($reservations as $reservation) {
            foreach (DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereIn('status', ['abierta', 'parcial', 'vencida'])->get() as $receivable) {
                DB::table('fin_payments')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->context->idOrFail(),
                    'code' => $this->sequences->next('payment'),
                    'reservation_id' => $reservation->id,
                    'receivable_id' => $receivable->id,
                    'kind' => 'cobro',
                    'source' => 'ecommerce',
                    'method' => 'tarjeta',
                    'amount' => (string) BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount),
                    'currency' => $receivable->currency,
                    'fx_rate' => $receivable->currency === 'USD' ? $reservation->fx_rate : null,
                    'paid_on' => $now->toDateString(),
                    'reference' => 'SIMULADO-'.$order->code,
                    'note' => 'Pago simulado desde el sitio web (demostración, sin pasarela real).',
                    'status' => 'aplicado',
                ]);
                DB::table('fin_receivables')->where('id', $receivable->id)->update(['paid_amount' => $receivable->amount, 'status' => 'pagada', 'updated_at' => now()]);
            }

            $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->get(['id', 'departure_id']);
            $pending = false;

            foreach ($services as $service) {
                $ref = $service->departure_id ? DB::table('catalog_product_departures')->where('id', $service->departure_id)->value('ref') : null;

                if ($ref) {
                    DB::table('booking_reservation_services')->where('id', $service->id)->update(['status' => 'confirmado', 'confirmation_code' => $ref, 'confirmed_by_name' => 'Cupo propio (salida programada)', 'confirmed_at' => now(), 'updated_at' => now()]);
                } else {
                    $pending = true;
                }
            }

            DB::table('booking_reservations')->where('id', $reservation->id)->update(['status' => $pending ? 'pendiente_proveedor' : 'confirmada', 'updated_at' => now()]);
            $this->audit->log('Reserva', $reservation->code, 'cambio_estado', 'pendiente_pago', $pending ? 'pendiente_proveedor' : 'confirmada');
            $this->payables->handle((string) $reservation->id);
        }

        foreach (DB::table('catalog_availability_holds')->where('reference_id', $order->id)->where('status', 'hold')->get(['id', 'departure_id', 'quantity']) as $hold) {
            if ($hold->departure_id) {
                $departure = DB::table('catalog_product_departures')->where('id', $hold->departure_id)->lock('for no key update')->first(['capacity', 'sold']);
                $sold = min((int) $departure->capacity, (int) $departure->sold + (int) $hold->quantity);
                DB::table('catalog_product_departures')->where('id', $hold->departure_id)->update(['sold' => $sold, 'status' => $sold >= (int) $departure->capacity ? 'completa' : 'abierta', 'updated_at' => now()]);
            }

            DB::table('catalog_availability_holds')->where('id', $hold->id)->update(['status' => 'confirmada', 'updated_at' => now()]);
        }

        DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'confirmado', 'updated_at' => now()]);
        $this->audit->log('Pedido web', $order->code, 'pago_simulado', 'pago_pendiente', 'confirmado');

        return $this->order($code, $token);
    }

    private function reservation(array $line, string $orderId, string $orderCode, string $clientId, string $owner, ?string $sede, array $data, float $fx, string $today): array
    {
        $item = $line['item'];
        $product = $line['product'];
        $quote = $line['quote'];
        $year = Carbon::parse($today)->year;
        $reservationId = (string) Str::uuid7();
        $code = $this->sequences->next('reservation');
        $days = max(1, (int) ceil((float) $product->days));
        $seats = (int) $item->pax_adults + (int) $item->pax_children;
        $rate = DB::table('catalog_rates')->where('id', $quote['rate_id'])->first(['cost']);

        DB::table('booking_reservations')->insert([
            'id' => $reservationId,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'client_id' => $clientId,
            'owner_id' => $owner,
            'sede_id' => $sede,
            'title' => $product->name,
            'status' => 'pendiente_pago',
            'channel' => 'E-commerce',
            'travel_from' => $item->service_date,
            'travel_to' => Carbon::parse($item->service_date)->addDays($days - 1)->toDateString(),
            'currency' => $quote['currency'],
            'fx_rate' => $fx,
            'total_amount' => $quote['total'],
            'snapshot_label' => Str::limit("Pedido web {$orderCode} · {$product->name} · {$item->service_date}", 295),
            'catalog_snapshot' => json_encode(['product' => $product->code, 'lines' => $quote['lines'], 'season' => $quote['season'], 'discount' => $quote['discount']], JSON_UNESCAPED_UNICODE),
            'policies_snapshot' => json_encode((array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund']) ?? []), JSON_UNESCAPED_UNICODE),
            'notes' => "Reserva creada desde el sitio web (pedido {$orderCode}).",
            'ecom_order_id' => $orderId,
        ]);

        $serviceId = (string) Str::uuid7();
        DB::table('booking_reservation_services')->insert([
            'id' => $serviceId,
            'tenant_id' => $this->context->idOrFail(),
            'reservation_id' => $reservationId,
            'code' => $this->codes->next('booking_reservation_services', 'RS-'),
            'product_id' => $product->id,
            'departure_id' => $item->departure_id,
            'provider_id' => DB::table('catalog_products')->where('id', $product->id)->value('main_provider_id'),
            'name' => $product->name,
            'service_date' => $item->service_date,
            'service_time' => $quote['departure']['time'] ?? null,
            'pax' => $seats,
            'pax_detail' => json_encode(['adt' => (int) $item->pax_adults, 'chd' => (int) $item->pax_children, 'inf' => (int) $item->pax_infants]),
            'status' => 'solicitado',
            'currency' => $quote['currency'],
            'fx_rate' => $fx,
            'cost_amount' => (string) Decimal::round2(BigDecimal::of((string) ($rate->cost ?? '0'))->multipliedBy($seats)),
            'price_amount' => $quote['total'],
            'service_kind' => $product->kind === 'traslados' ? 'traslado' : 'tour',
            'requested_at' => now(),
        ]);

        $this->passengers($reservationId, $item, $data);
        $receivableId = (string) Str::uuid7();
        DB::table('fin_receivables')->insert([
            'id' => $receivableId,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $this->sequences->next('receivable'),
            'reservation_id' => $reservationId,
            'client_id' => $clientId,
            'kind' => 'total',
            'concept' => Str::limit("Pago total — pedido web {$orderCode} · {$product->name}", 250),
            'amount' => $quote['total'],
            'currency' => $quote['currency'],
            'fx_rate' => $fx,
            'due_date' => $today,
            'status' => 'abierta',
        ]);
        $this->audit->log('Reserva', $code, 'crear_ecommerce', after: "pendiente_pago · {$quote['currency']} {$quote['total']}");

        return [$reservationId, $receivableId, $serviceId];
    }

    private function passengers(string $reservationId, stdClass $item, array $data): void
    {
        $rows = [['ADT', trim($data['name']), true]];

        for ($i = 2; $i <= (int) $item->pax_adults; $i++) {
            $rows[] = ['ADT', "Adulto {$i} (por completar)", false];
        }

        for ($i = 1; $i <= (int) $item->pax_children; $i++) {
            $rows[] = ['CHD', "Niño {$i} (por completar)", false];
        }

        for ($i = 1; $i <= (int) $item->pax_infants; $i++) {
            $rows[] = ['INF', "Infante {$i} (por completar)", false];
        }

        foreach ($rows as $index => [$type, $name, $lead]) {
            DB::table('booking_passengers')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'reservation_id' => $reservationId,
                'seq' => $index + 1,
                'full_name' => Str::limit($name, 145),
                'doc_type' => $lead ? ($data['doc_type'] === 'Pasaporte' ? 'Pasaporte' : $data['doc_type']) : null,
                'doc_number' => $lead ? Str::upper($data['doc_number']) : null,
                'pax_type' => $type,
                'nationality' => $lead ? ($data['country'] ?? 'Perú') : null,
                'phone' => $lead ? $data['phone'] : null,
                'email' => $lead ? Str::lower($data['email']) : null,
                'relationship' => $lead ? 'Titular' : null,
                'is_lead' => $lead,
                'is_placeholder' => ! $lead,
                'pending' => ! $lead,
            ]);
        }
    }

    private function client(array $data, string $owner): string
    {
        $email = Str::lower(trim($data['email']));
        $existing = DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id');

        if ($existing) {
            return (string) $existing;
        }

        $id = (string) Str::uuid7();
        $code = $this->codes->next('crm_clients', 'CLI-');
        DB::table('crm_clients')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'kind' => 'persona',
            'name' => trim($data['name']),
            'doc_type' => self::DOC_TYPES[$data['doc_type']] ?? 'DNI',
            'doc_number' => Str::upper(preg_replace('/\s+/', '', $data['doc_number'])),
            'email' => $email,
            'phone' => $data['phone'],
            'phone_norm' => substr((string) preg_replace('/\D/', '', $data['phone']), -9) ?: null,
            'country' => $data['country'] ?? 'Perú',
            'segment_code' => 'Retail',
            'owner_id' => $owner,
            'tags' => '{Web}',
            'consents' => json_encode(['privacy' => true, 'marketing' => (bool) ($data['marketing'] ?? false), 'policy_version' => CaptureWebLead::POLICY_VERSION], JSON_UNESCAPED_UNICODE),
        ]);
        $this->audit->log('Cliente', $code, 'crear_desde_sitio_web', after: 'Retail · Web');

        return $id;
    }

    private function owner(): string
    {
        foreach (['channels.ecommerce.manage', 'reservations.create'] as $permission) {
            $id = DB::table('iam_users as u')
                ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
                ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
                ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
                ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('u.client_id')->where('p.name', $permission)
                ->orderBy('u.code')->value('u.id');

            if ($id) {
                return (string) $id;
            }
        }

        throw ApiException::conflict('ECOM_OWNER', 'La agencia aún no tiene un responsable de ventas en línea.');
    }

    public function authorize(string $code, ?string $token, bool $lock = false): stdClass
    {
        $query = DB::table('channel_ecom_orders')->where('code', $code);
        $order = ($lock ? $query->lockForUpdate() : $query)->first();

        if ($order === null || $token === null || ! hash_equals((string) $order->access_token_hash, hash('sha256', $token))) {
            throw ApiException::notFound('No encontramos ese pedido.');
        }

        return $order;
    }
}
