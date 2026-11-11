<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\CardPayments;
use App\Domain\Site\Support\CheckoutRules;
use App\Domain\Site\Support\CheckoutTerms;
use App\Domain\Site\Support\SiteBooking;
use App\Domain\Site\Support\SiteProfile;
use App\Domain\Site\Support\SiteQuote;
use App\Domain\Site\Support\WebClients;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class SiteCheckout
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly SiteCart $carts,
        private readonly SiteQuote $quotes,
        private readonly SiteProfile $profile,
        private readonly SubscribeNewsletter $newsletter,
        private readonly ReceivableLedger $ledger,
        private readonly CheckoutTerms $terms,
        private readonly WebClients $clients,
        private readonly CardPayments $cards,
    ) {}

    public function options(?string $token): array
    {
        [, $lines] = $this->cartLines($token, false);

        return $this->terms->build($lines, $this->today(), $this->rate());
    }

    public function validate(?string $token, string $step, array $data): array
    {
        $terms = $this->options($token);

        match ($step) {
            'comprador' => CheckoutRules::buyer($data),
            'pasajeros' => CheckoutRules::passengers($data, $terms),
            'recojo' => CheckoutRules::lines($data, $terms),
            'pago' => CheckoutRules::payment($data, $terms),
            default => null,
        };

        return ['step' => $step, 'valid' => true, 'terms' => $terms];
    }

    public function place(?string $token, array $data): array
    {
        $buyer = CheckoutRules::buyer($data);

        return DB::transaction(function () use ($token, $data, $buyer): array {
            [$cart, $lines] = $this->cartLines($token, true);
            $today = $this->today();
            $rate = $this->rate();
            $terms = $this->terms->build($lines, $today, $rate);
            $passengers = CheckoutRules::passengers($data, $terms);
            $extras = CheckoutRules::lines($data, $terms);
            $payment = CheckoutRules::payment($data, $terms);
            $deposit = $payment['pay_mode'] === 'adelanto';
            $payLater = $payment['pay_mode'] === CheckoutTerms::PAY_LATER;
            $mode = collect($terms['modes'])->firstWhere('value', $payment['pay_mode']);
            $now = Carbon::now($this->context->timezone());
            $holdUntil = $payLater ? Carbon::now()->addHours($this->terms->payLaterHours()) : null;
            $owner = $this->clients->owner();
            $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('id');
            $currency = $terms['currency'];
            $convert = fn (string $amount, string $from): BigDecimal => Decimal::round2(Decimal::convert($amount, $from, $currency, $rate));
            $discount = (string) $lines->reduce(fn (BigDecimal $sum, array $l): BigDecimal => $sum->plus($convert($l['quote']['discount']['amount'] ?? '0', $l['quote']['currency'])), BigDecimal::zero()->toScale(2));
            $clientId = $this->clients->resolve($buyer, $owner, (bool) ($payment['marketing'] ?? false));
            $orderId = (string) Str::uuid7();
            $orderCode = $this->sequences->next('web_order');
            $accessToken = Str::random(48);
            $billing = $buyer['billing_type'] === 'Factura'
                ? ['type' => 'Factura', 'doc_type' => 'RUC', 'doc_number' => $buyer['ruc'], 'name' => $buyer['business_name'], 'fiscal_address' => $buyer['fiscal_address']]
                : ['type' => 'Boleta', 'doc_type' => $buyer['doc_type'], 'doc_number' => Str::upper($buyer['doc_number']), 'name' => trim($buyer['name'])];
            $first = $lines->first();

            DB::table('channel_ecom_orders')->insert([
                'id' => $orderId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $orderCode,
                'ordered_at' => $now,
                'crm_client_id' => $clientId,
                'customer_name' => trim($buyer['name']),
                'customer_email' => Str::lower(trim($buyer['email'])),
                'customer_phone' => $buyer['phone'],
                'customer_country' => $buyer['country'],
                'product_id' => $lines->count() === 1 ? $first['product']->id : null,
                'departure_id' => $lines->count() === 1 ? $first['item']->departure_id : null,
                'service_date' => $lines->count() === 1 ? $first['item']->service_date : null,
                'pax_adults' => $lines->count() === 1 ? (int) $first['item']->pax_adults : null,
                'pax_children' => $lines->count() === 1 ? (int) $first['item']->pax_children : 0,
                'config_snapshot' => json_encode($extras, JSON_UNESCAPED_UNICODE),
                'price_snapshot' => json_encode($lines->map(fn (array $l): array => ['product' => $l['product']->name, 'date' => $l['item']->service_date, 'lines' => $l['quote']['lines'], 'total' => $l['quote']['total'], 'currency' => $l['quote']['currency'], 'season' => $l['quote']['season']])->all(), JSON_UNESCAPED_UNICODE),
                'promo_code' => $cart->promo_code,
                'discount_amount' => $discount,
                'total' => $terms['total'],
                'currency' => $currency,
                'fx_rate' => $rate,
                'status' => 'pago_pendiente',
                'hold_expires_at' => $holdUntil ?? $lines->map(fn (array $l): ?string => $l['item']->hold_expires_at)->filter()->min(),
                'buyer_snapshot' => json_encode(collect($buyer)->only(['name', 'email', 'phone', 'country', 'doc_type', 'doc_number', 'birth_date', 'nationality', 'diet'])->all(), JSON_UNESCAPED_UNICODE),
                'cart_id' => $cart->id,
                'sales_channel' => 'sitio_web',
                'locale' => 'es',
                'pay_mode' => $deposit ? 'anticipo' : 'total',
                'deposit_pct' => $deposit || $payLater ? $mode['pct'] : 100,
                'amount_due_now' => $mode['amount'],
                'balance_due_date' => $deposit ? $mode['balance_due'] : $holdUntil?->copy()->setTimezone($this->context->timezone())->toDateString(),
                'billing' => json_encode($billing, JSON_UNESCAPED_UNICODE),
                'consents' => json_encode(['terms_at' => $now->toIso8601String(), 'cancellation_at' => $now->toIso8601String(), 'privacy_at' => $now->toIso8601String(), 'marketing_at' => ($payment['marketing'] ?? false) ? $now->toIso8601String() : null, 'policy_version' => CaptureWebLead::POLICY_VERSION], JSON_UNESCAPED_UNICODE),
                'access_token_hash' => hash('sha256', $accessToken),
            ]);

            foreach ($passengers as $index => $passenger) {
                DB::table('channel_ecom_passengers')->insert([
                    'order_id' => $orderId,
                    'position' => $index + 1,
                    'first_name' => trim($passenger['first_name']),
                    'last_name' => trim($passenger['last_name']),
                    'doc_type' => $passenger['doc_type'] ?? 'Pendiente',
                    'doc_number' => Str::upper((string) ($passenger['doc_number'] ?? 'Pendiente')),
                    'pax_type' => $passenger['pax_type'],
                    'birth_date' => $passenger['birth_date'],
                    'nationality' => $passenger['nationality'],
                    'diet' => $passenger['diet'] ?? null,
                ]);
            }

            $reservations = [];
            $receivables = [];

            foreach ($lines->values() as $index => $line) {
                $termsLine = $terms['items'][$index];
                [$reservationId, $receivableId, $serviceId] = $this->reservation($line, $termsLine, $extras[$index], $orderId, $orderCode, $clientId, $owner, $sede, $buyer, $passengers, $deposit, $rate, $today, $currency, $holdUntil);
                $reservations[] = $reservationId;
                $receivables[] = $receivableId;
                $quote = $line['quote'];
                $rateRow = DB::table('catalog_rates')->where('id', $quote['rate_id'])->first(['cost', 'season_id']);
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
                    'season_id' => $rateRow?->season_id,
                    'season_factor' => $quote['season']['factor'] ?? 1,
                    'unit_adult' => collect($quote['lines'])->firstWhere('key', 'adults')['unit'] ?? $quote['lines'][0]['unit'],
                    'unit_child' => collect($quote['lines'])->firstWhere('key', 'children')['unit'] ?? '0',
                    'units' => collect($quote['lines'])->firstWhere('key', 'service')['qty'] ?? null,
                    'subtotal' => $quote['subtotal'],
                    'discount' => $quote['discount']['amount'] ?? '0',
                    'total' => $quote['total'],
                    'currency' => $quote['currency'],
                    'cost_total' => (string) Decimal::round2(BigDecimal::of((string) ($rateRow->cost ?? '0'))->multipliedBy($seats)),
                    'hold_id' => $line['item']->hold_id,
                    'reservation_service_id' => $serviceId,
                ]);
            }

            DB::table('channel_ecom_orders')->where('id', $orderId)->update(['reservation_id' => $reservations[0], 'reservation_ids' => '{'.implode(',', $reservations).'}', 'receivable_id' => $receivables[0], 'cost_total' => DB::table('channel_ecom_order_lines')->where('order_id', $orderId)->sum('cost_total')]);
            DB::table('channel_web_carts')->where('id', $cart->id)->update(['status' => 'convertido', 'order_id' => $orderId, 'crm_client_id' => $clientId, 'last_activity_at' => now()]);
            WidgetHandoffs::convert((string) $cart->id);
            DB::table('catalog_availability_holds')->whereIn('id', $lines->pluck('item.hold_id')->filter()->all())->update(['reference' => $orderCode, 'reference_type' => 'order', 'reference_id' => $orderId, ...($holdUntil ? ['expires_at' => $holdUntil] : []), 'updated_at' => now()]);

            if ($payment['marketing'] ?? false) {
                $this->newsletter->handle($buyer['email'], $buyer['name']);
            }

            $this->audit->log('Pedido web', $orderCode, 'crear', after: "pago_pendiente · {$currency} {$terms['total']} · ".match (true) {
                $deposit => "adelanto {$mode['amount']}",
                $payLater => 'pagar después · bloqueo hasta '.$holdUntil->copy()->setTimezone($this->context->timezone())->format('d/m/Y H:i'),
                default => 'pago total',
            });
            $order = DB::table('channel_ecom_orders')->where('id', $orderId)->first();
            $attempt = empty($payment['method']) ? null : $this->charge($order, $payment);

            return ['code' => $orderCode, 'token' => $accessToken, 'payment' => $attempt];
        });
    }

    public function order(string $code, ?string $token): array
    {
        $order = $this->authorize($code, $token);
        $reservations = DB::table('booking_reservations')->where('ecom_order_id', $order->id)->orderBy('travel_from')->get(['id', 'code', 'status', 'title', 'travel_from', 'currency', 'total_amount']);
        $services = DB::table('booking_reservation_services')->whereIn('reservation_id', $reservations->pluck('id'))->get(['reservation_id', 'name', 'service_date', 'service_time', 'pax', 'status', 'confirmation_code']);
        $receivables = DB::table('fin_receivables')->whereIn('reservation_id', $reservations->pluck('id'))->get(['reservation_id', 'code', 'kind', 'concept', 'amount', 'paid_amount', 'currency', 'status', 'due_date']);
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
            'pay_mode' => $order->pay_mode,
            'deposit_pct' => (float) $order->deposit_pct,
            'amount_due_now' => Decimal::toApi((string) $order->amount_due_now),
            'balance_due_date' => $order->balance_due_date,
            'pay_later' => DB::table('booking_reservation_web_snapshots')->where('order_code', $order->code)->where('payment_mode', CheckoutTerms::PAY_LATER)->exists(),
            'due' => $this->dueAmount($order),
            'methods' => collect(CheckoutTerms::METHODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'bank_accounts' => CheckoutTerms::bankAccounts(),
            'passengers' => DB::table('channel_ecom_passengers')->where('order_id', $order->id)->orderBy('position')->get(['full_name', 'pax_type'])->map(fn (stdClass $p): array => ['name' => $p->full_name, 'type' => $p->pax_type])->all(),
            'attempts' => DB::table('channel_ecom_payment_attempts')->where('order_id', $order->id)->orderByDesc('attempted_at')->get(['attempted_at', 'method', 'card_masked', 'operation_ref', 'result', 'gateway_code', 'message', 'amount', 'currency'])
                ->map(fn (stdClass $a): array => ['at' => Carbon::parse($a->attempted_at)->toIso8601String(), 'method' => CheckoutTerms::METHODS[$a->method] ?? $a->method, 'card' => $a->card_masked, 'operation' => $a->operation_ref, 'result' => $a->result, 'code' => $a->gateway_code, 'message' => $a->message, 'amount' => $a->amount === null ? null : Decimal::toApi((string) $a->amount), 'currency' => $a->currency])->all(),
            'reservations' => $reservations->map(fn (stdClass $r): array => [
                'code' => $r->code,
                'status' => $r->status,
                'title' => $r->title,
                'date' => $r->travel_from,
                'total' => Decimal::toApi((string) $r->total_amount),
                'currency' => $r->currency,
                'services' => $services->where('reservation_id', $r->id)->map(fn (stdClass $s): array => ['name' => $s->name, 'date' => $s->service_date, 'time' => $s->service_time ? substr((string) $s->service_time, 0, 5) : null, 'pax' => (int) $s->pax, 'status' => $s->status, 'confirmation' => $s->confirmation_code])->values()->all(),
                'receivables' => $receivables->where('reservation_id', $r->id)->map(fn (stdClass $c): array => ['code' => $c->code, 'kind' => $c->kind, 'concept' => $c->concept, 'amount' => Decimal::toApi((string) $c->amount), 'paid' => Decimal::toApi((string) $c->paid_amount), 'currency' => $c->currency, 'status' => $c->status, 'due_date' => $c->due_date])->values()->all(),
                'vouchers' => $vouchers->where('reservation_id', $r->id)->map(fn (stdClass $v): array => ['code' => $v->code, 'label' => $v->service_label, 'date' => $v->service_date, 'status' => $v->status])->values()->all(),
            ])->all(),
        ];
    }

    public function pay(string $code, ?string $token, array $data): array
    {
        $payment = CheckoutRules::retry($data);

        return DB::transaction(function () use ($code, $token, $payment): array {
            $order = $this->authorize($code, $token, true);
            $this->ensurePayable($order);

            $attempt = $this->charge($order, $payment);

            return [...$this->order($code, $token), 'payment' => $attempt];
        });
    }

    public function authorize(string $code, ?string $token, bool $lock = false): stdClass
    {
        $query = DB::table('channel_ecom_orders')->where('code', $code);
        $order = ($lock ? $query->lockForUpdate() : $query)->first();

        if ($order === null || $token === null || ! (hash_equals((string) $order->access_token_hash, hash('sha256', $token)) || hash_equals(self::grant($order), $token) || self::validLink($order, $token))) {
            throw ApiException::notFound('No encontramos ese pedido.');
        }

        return $order;
    }

    public static function paymentLink(stdClass $order, string $until): string
    {
        return 'p.'.$until.'.'.hash_hmac('sha256', 'pay|'.$order->id.'|'.Str::lower((string) $order->customer_email).'|'.$until, (string) config('app.key'));
    }

    private static function validLink(stdClass $order, string $token): bool
    {
        $parts = explode('.', $token);

        return count($parts) === 3 && $parts[0] === 'p' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $parts[1]) === 1 && $parts[1] >= Carbon::today()->toDateString()
            && hash_equals(self::paymentLink($order, $parts[1]), $token);
    }

    public static function grant(stdClass $order): string
    {
        return 'g.'.hash_hmac('sha256', $order->id.'|'.Str::lower((string) $order->customer_email).'|'.Carbon::today()->toDateString(), (string) config('app.key'));
    }

    public function session(string $code, ?string $token, ?string $returnUrl): array
    {
        $order = $this->authorize($code, $token);
        $this->ensurePayable($order);

        return [...$this->cards->openSession('order', (string) $order->code, $this->dueAmount($order), (string) $order->currency, (string) $order->customer_email, $returnUrl), 'order' => $order->code];
    }

    public function settle(string $code, array $card): array
    {
        $order = DB::table('channel_ecom_orders')->where('code', $code)->lockForUpdate()->first();

        if ($order === null) {
            throw ApiException::notFound('No encontramos ese pedido.');
        }

        if ($card['txn'] !== null && DB::table('channel_ecom_payment_attempts')->where('gateway_txn_id', $card['txn'])->exists()) {
            return ['result' => 'duplicado', 'message' => 'El cobro ya estaba registrado.'];
        }

        if ($this->dueReceivables($order)->isEmpty() || in_array($order->status, ['cancelado', 'expirado'], true)) {
            $this->audit->log('Pedido web', (string) $order->code, 'pago_sin_deuda', $order->status, ($card['approved'] ? 'aprobado' : 'rechazado').' · '.($card['txn'] ?? 'sin referencia'));

            return ['result' => 'sin_deuda', 'message' => 'El pedido no tenía pagos pendientes.'];
        }

        return $this->charge($order, ['method' => 'tarjeta'], $card);
    }

    private function ensurePayable(stdClass $order): void
    {
        if (in_array($order->status, ['cancelado', 'expirado', 'pago_por_validar'], true)) {
            throw ApiException::conflict('ORDER_STATE', $order->status === 'pago_por_validar' ? 'Tu pago está en validación; te avisaremos por correo.' : 'Este pedido ya no admite pagos.');
        }

        if ($this->dueReceivables($order)->isEmpty()) {
            throw ApiException::conflict('ORDER_STATE', 'Este pedido no tiene pagos pendientes.');
        }
    }

    private function charge(stdClass $order, array $payment, ?array $settled = null): array
    {
        $now = Carbon::now($this->context->timezone());
        $due = $this->dueReceivables($order);
        $balanceOnly = $due->every(fn (stdClass $r): bool => $r->kind === 'saldo');
        $amount = $this->dueAmount($order);
        $method = $payment['method'];
        $card = $method === 'tarjeta' ? ($settled ?? $this->cards->charge('order', (string) $order->code, $amount, (string) $order->currency, (string) $order->customer_email, (string) ($payment['card_token'] ?? ''), $payment['session_id'] ?? null)) : null;
        $result = $method === 'tarjeta' ? ($card['approved'] ? 'aprobado' : 'rechazado') : 'por_validar';
        $txn = $card['txn'] ?? null;
        $paymentIds = [];

        if ($result !== 'rechazado') {
            foreach ($due as $receivable) {
                $id = (string) Str::uuid7();
                $open = BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount);
                DB::table('fin_payments')->insert([
                    'id' => $id,
                    'tenant_id' => $this->context->idOrFail(),
                    'code' => $this->sequences->next('payment'),
                    'reservation_id' => $receivable->reservation_id,
                    'receivable_id' => $receivable->id,
                    'kind' => 'cobro',
                    'source' => 'ecommerce',
                    'method' => $method === 'tarjeta' ? 'tarjeta_e_commerce' : $method,
                    'amount' => (string) $open,
                    'currency' => $receivable->currency,
                    'fx_rate' => $receivable->currency === 'USD' ? $order->fx_rate : null,
                    'paid_on' => $now->toDateString(),
                    'reference' => $result === 'aprobado' ? $txn : $payment['operation_ref'],
                    'note' => $result === 'aprobado' ? "Cobro en línea del pedido {$order->code} (pasarela {$this->cards->gatewayName()})." : "Pago informado en el sitio web, pedido {$order->code}. Por validar.",
                    'status' => $result === 'aprobado' ? 'aplicado' : 'pendiente',
                ]);
                $paymentIds[] = $id;

                if ($result === 'aprobado') {
                    DB::table('fin_payment_applications')->insert(['payment_id' => $id, 'receivable_id' => $receivable->id, 'amount' => (string) $open, 'applied_at' => now()]);
                }
            }
        }

        DB::table('channel_ecom_payment_attempts')->insert([
            'order_id' => $order->id,
            'attempted_at' => $now,
            'method' => $method,
            'card_masked' => $card['masked'] ?? null,
            'operation_ref' => $method === 'tarjeta' ? null : $payment['operation_ref'],
            'result' => $result,
            'gateway_code' => $card['code'] ?? null,
            'message' => $card['message'] ?? 'Pago informado; lo validamos en un plazo de 4 horas hábiles.',
            'gateway_txn_id' => $txn,
            'amount' => $amount,
            'currency' => $order->currency,
            'payment_id' => $paymentIds[0] ?? null,
        ]);

        if ($result === 'rechazado') {
            if ($order->status === 'pago_pendiente') {
                DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'pago_rechazado', 'updated_at' => now()]);
            }
            $this->audit->log('Pedido web', $order->code, 'pago_rechazado', $order->status, "código {$card['code']}");

            return ['result' => 'rechazado', 'message' => $card['message']];
        }

        if ($result === 'aprobado') {
            foreach ($due as $receivable) {
                $this->ledger->recalculate((string) $receivable->id, null);
            }

            foreach ($paymentIds as $paymentId) {
                PaymentApplied::dispatch($paymentId, null);
            }
        }

        if (! $balanceOnly) {
            $this->consumeHolds($order);
            DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => $result === 'aprobado' ? 'confirmado' : 'pago_por_validar', 'updated_at' => now()]);
        }

        $this->audit->log('Pedido web', $order->code, $result === 'aprobado' ? 'pago_aprobado' : 'pago_por_validar', $order->status, ($balanceOnly ? 'saldo · ' : '').CheckoutTerms::METHODS[$method]." · {$order->currency} {$amount}");

        return ['result' => $result, 'message' => $result === 'aprobado' ? 'Pago aprobado.' : 'Recibimos tu número de operación. Validamos el pago en un plazo de 4 horas hábiles.'];
    }

    private function dueReceivables(stdClass $order): Collection
    {
        $open = DB::table('fin_receivables')->whereIn('reservation_id', DB::table('booking_reservations')->where('ecom_order_id', $order->id)->pluck('id'))->whereIn('status', ['abierta', 'parcial', 'vencida'])->orderBy('due_date')->get();
        $now = $open->where('kind', '<>', 'saldo');
        $hasPending = DB::table('fin_payments')->whereIn('receivable_id', $open->pluck('id'))->where('status', 'pendiente')->exists();

        return $hasPending ? collect() : ($now->isNotEmpty() ? $now->values() : $open->values());
    }

    private function dueAmount(stdClass $order): string
    {
        $rate = (string) $order->fx_rate;
        $sum = $this->dueReceivables($order)->reduce(fn (BigDecimal $total, stdClass $r): BigDecimal => $total->plus(Decimal::round2(Decimal::convert((string) BigDecimal::of((string) $r->amount)->minus((string) $r->paid_amount), (string) $r->currency, (string) $order->currency, $rate))), BigDecimal::zero()->toScale(2));

        return (string) $sum;
    }

    private function consumeHolds(stdClass $order): void
    {
        foreach (DB::table('catalog_availability_holds')->where('reference_id', $order->id)->where('status', 'hold')->get(['id', 'departure_id', 'quantity']) as $hold) {
            if ($hold->departure_id) {
                $departure = DB::table('catalog_product_departures')->where('id', $hold->departure_id)->lock('for no key update')->first(['capacity', 'sold']);
                $sold = min((int) $departure->capacity, (int) $departure->sold + (int) $hold->quantity);
                DB::table('catalog_product_departures')->where('id', $hold->departure_id)->update(['sold' => $sold, 'status' => $sold >= (int) $departure->capacity ? 'completa' : 'abierta', 'updated_at' => now()]);
            }

            DB::table('catalog_availability_holds')->where('id', $hold->id)->update(['status' => 'confirmada', 'updated_at' => now()]);
        }
    }

    private function cartLines(?string $token, bool $lock): array
    {
        $cart = $this->carts->find($token) ?? throw ApiException::notFound('Tu carrito expiró o ya fue procesado.');
        if ($lock) {
            DB::table('channel_web_carts')->where('id', $cart->id)->lockForUpdate()->first();
        }
        $items = DB::table('channel_web_cart_items')->where('cart_id', $cart->id)->orderBy('line_no')->get();

        if ($items->isEmpty()) {
            throw ApiException::unprocessable('CART_EMPTY', 'Tu carrito está vacío.');
        }

        $lines = $items->map(function (stdClass $item) use ($cart, $lock): array {
            $product = $this->quotes->product((string) DB::table('catalog_products')->where('id', $item->product_id)->value('slug'));
            $quote = $this->quotes->quote($product, $item->service_date, (int) $item->pax_adults, (int) $item->pax_children, (int) $item->pax_infants, $cart->promo_code, SiteBooking::decode($item));
            $hold = $item->hold_id ? DB::table('catalog_availability_holds')->where('id', $item->hold_id)->first(['status', 'expires_at']) : null;

            if ($lock && $item->hold_id && ($hold === null || $hold->status !== 'hold' || Carbon::parse($hold->expires_at)->isPast())) {
                $this->carts->hold($cart, $item);
                $item = DB::table('channel_web_cart_items')->where('id', $item->id)->first();
            }

            return ['item' => $item, 'product' => $product, 'quote' => $quote];
        })->values();

        return [$cart, $lines];
    }

    private function reservation(array $line, array $termsLine, array $extra, string $orderId, string $orderCode, string $clientId, string $owner, ?string $sede, array $buyer, array $passengers, bool $deposit, string $rate, string $today, string $currency, ?Carbon $holdUntil = null): array
    {
        $item = $line['item'];
        $product = $line['product'];
        $quote = $line['quote'];
        $reservationId = (string) Str::uuid7();
        $code = $this->sequences->next('reservation');
        $days = max(1, (int) ceil((float) $product->days));
        $seats = (int) $item->pax_adults + (int) $item->pax_children;
        $rateRow = DB::table('catalog_rates')->where('id', $quote['rate_id'])->first(['cost']);
        $total = BigDecimal::of((string) $quote['total']);
        $depositAmount = Decimal::round2($total->multipliedBy($termsLine['deposit_pct'])->dividedBy(100, 6, RoundingMode::HALF_UP));

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
            'fx_rate' => $rate,
            'total_amount' => $quote['total'],
            'snapshot_label' => Str::limit("Pedido web {$orderCode} · {$product->name} · {$item->service_date}", 295),
            'catalog_snapshot' => json_encode(['product' => $product->code, 'lines' => $quote['lines'], 'season' => $quote['season'], 'discount' => $quote['discount']], JSON_UNESCAPED_UNICODE),
            'policies_snapshot' => json_encode([$product->code => (array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund', 'penalty_tiers']) ?? [])], JSON_UNESCAPED_UNICODE),
            'notes' => trim("Reserva creada desde el sitio web (pedido {$orderCode}).".($extra['comments'] ? " Comentarios del cliente: {$extra['comments']}" : '')),
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
            'fx_rate' => $rate,
            'cost_amount' => (string) Decimal::round2(BigDecimal::of((string) ($rateRow->cost ?? '0'))->multipliedBy($seats)),
            'price_amount' => $quote['total'],
            'service_kind' => $product->kind === 'traslados' ? 'traslado' : 'tour',
            'requested_at' => now(),
        ]);

        $this->passengers($reservationId, $item, $buyer, $passengers);

        $receivables = $deposit
            ? [['adelanto', "Adelanto {$termsLine['deposit_pct']} % — pedido web {$orderCode} · {$product->name}", $depositAmount, $today], ['saldo', 'Saldo '.(100 - $termsLine['deposit_pct'])." % — pedido web {$orderCode} · {$product->name}", $total->minus($depositAmount), $termsLine['balance_due']]]
            : [['total', ($holdUntil ? 'Pago total (reservado, pagar después)' : 'Pago total')." — pedido web {$orderCode} · {$product->name}", $total, $holdUntil?->copy()->setTimezone($this->context->timezone())->toDateString() ?? $today]];
        $firstReceivable = null;

        foreach ($receivables as [$kind, $concept, $amount, $due]) {
            $id = (string) Str::uuid7();
            $firstReceivable ??= $id;
            DB::table('fin_receivables')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $this->sequences->next('receivable'),
                'reservation_id' => $reservationId,
                'client_id' => $clientId,
                'kind' => $kind,
                'concept' => Str::limit($concept, 250),
                'amount' => (string) Decimal::round2($amount),
                'currency' => $quote['currency'],
                'fx_rate' => $rate,
                'due_date' => $due,
                'status' => 'abierta',
            ]);
        }

        DB::table('booking_reservation_web_snapshots')->insert([
            'reservation_id' => $reservationId,
            'product_id' => $product->id,
            'service_date' => $item->service_date,
            'pax_adt' => (int) $item->pax_adults,
            'pax_chd' => (int) $item->pax_children,
            'pax_inf' => (int) $item->pax_infants,
            'currency_display' => $currency,
            'charge_currency' => $quote['currency'],
            'fx_rate' => $rate,
            'lines' => json_encode($quote['lines'], JSON_UNESCAPED_UNICODE),
            'adjustments' => json_encode($quote['discount'] ? [$quote['discount']] : [], JSON_UNESCAPED_UNICODE),
            'total' => $quote['total'],
            'pickup_point' => $extra['pickup_point'],
            'pickup_address' => $extra['pickup_address'],
            'pickup_flight' => $extra['pickup_flight'],
            'pickup_arrival' => $extra['pickup_arrival'],
            'comments' => $extra['comments'],
            'payment_mode' => $deposit ? 'adelanto' : ($holdUntil ? CheckoutTerms::PAY_LATER : 'total'),
            'deposit_pct' => $deposit ? $termsLine['deposit_pct'] : ($holdUntil ? 0 : 100),
            'deposit' => (string) ($deposit ? $depositAmount : ($holdUntil ? BigDecimal::zero()->toScale(2) : $total)),
            'balance' => (string) ($deposit ? Decimal::round2($total->minus($depositAmount)) : ($holdUntil ? $total : BigDecimal::zero()->toScale(2))),
            'balance_due' => $deposit ? $termsLine['balance_due'] : $holdUntil?->copy()->setTimezone($this->context->timezone())->toDateString(),
            'companions_pending' => $passengers === [],
            'rules_applied' => '{'.implode(',', array_keys(array_filter(['R-DEPOSIT' => $deposit, 'R-PAY-LATER' => $holdUntil !== null, 'R-PICKUP' => $termsLine['pickup'] !== null, 'R-COMMENTS' => $termsLine['comments'] !== null]))).'}',
            'source' => 'sitio_web',
            'order_code' => $orderCode,
        ]);
        $this->audit->log('Reserva', $code, 'crear_ecommerce', after: "pendiente_pago · {$quote['currency']} {$quote['total']}");

        return [$reservationId, $firstReceivable, $serviceId];
    }

    private function passengers(string $reservationId, stdClass $item, array $buyer, array $passengers): void
    {
        $byType = ['ADT' => [], 'CHD' => [], 'INF' => []];
        foreach ($passengers as $passenger) {
            $byType[$passenger['pax_type']][] = $passenger;
        }

        $rows = [];
        foreach (['ADT' => (int) $item->pax_adults, 'CHD' => (int) $item->pax_children, 'INF' => (int) $item->pax_infants] as $type => $count) {
            for ($i = 0; $i < $count; $i++) {
                $rows[] = [$type, $byType[$type][$i] ?? null];
            }
        }

        foreach ($rows as $index => [$type, $passenger]) {
            $lead = $index === 0;
            $label = ['ADT' => 'Adulto', 'CHD' => 'Niño', 'INF' => 'Infante'][$type].' '.($index + 1).' (por completar)';
            $name = $passenger ? trim($passenger['first_name'].' '.$passenger['last_name']) : ($lead ? trim($buyer['name']) : $label);
            DB::table('booking_passengers')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'reservation_id' => $reservationId,
                'seq' => $index + 1,
                'full_name' => Str::limit($name, 145),
                'doc_type' => $passenger['doc_type'] ?? ($lead ? $buyer['doc_type'] : null),
                'doc_number' => isset($passenger['doc_number']) ? Str::upper((string) $passenger['doc_number']) : ($lead ? Str::upper($buyer['doc_number']) : null),
                'pax_type' => $type,
                'nationality' => $passenger['nationality'] ?? ($lead ? ($buyer['nationality'] ?? $buyer['country']) : null),
                'birth_date' => $passenger['birth_date'] ?? ($lead ? ($buyer['birth_date'] ?? null) : null),
                'diet_notes' => $passenger['diet'] ?? ($lead ? ($buyer['diet'] ?? null) : null),
                'phone' => $lead ? $buyer['phone'] : null,
                'email' => $lead ? Str::lower($buyer['email']) : null,
                'relationship' => $lead ? 'Titular' : null,
                'is_lead' => $lead,
                'is_placeholder' => $passenger === null && ! $lead,
                'pending' => $passenger === null && ! $lead,
            ]);
        }
    }

    private function today(): string
    {
        return Carbon::now($this->context->timezone())->toDateString();
    }

    private function rate(): string
    {
        return number_format($this->profile->usdRate(), 6, '.', '');
    }
}
