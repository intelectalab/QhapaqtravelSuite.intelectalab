<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Contracts\PlatformCheckoutGateway;
use App\Domain\Landing\Support\SignupQuote;
use App\Domain\Landing\Support\SignupState;
use App\Domain\Platform\Actions\ChangeTenantStatus;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\PlatformSequence;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Tracking\Actions\ConversionWorkflow;
use App\Domain\Tracking\Support\TagScope;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class CheckoutSignup
{
    public function __construct(
        private readonly SignupState $state,
        private readonly SignupQuote $quote,
        private readonly PlatformInvoicer $invoicer,
        private readonly PlatformCheckoutGateway $gateway,
        private readonly ChangeTenantStatus $status,
        private readonly PlatformSession $session,
        private readonly ConversionWorkflow $conversions,
    ) {}

    public static function validate(array $input): array
    {
        return Validator::make($input, [
            'method' => ['required', 'in:tarjeta,yape,plin,paypal'],
            'card_token' => ['required_if:method,tarjeta', 'nullable', 'string', 'max:120'],
            'phone' => ['required_if:method,yape,plin', 'nullable', 'string', 'regex:/^9\d{8}$/'],
            'approval_code' => ['nullable', 'string', 'max:10'],
            'paypal_order_id' => ['required_if:method,paypal', 'nullable', 'string', 'max:60'],
            'expected_total' => ['nullable', 'numeric', 'min:0'],
        ], [
            'method.*' => 'Elige tarjeta, Yape, Plin o PayPal.',
            'card_token.required_if' => 'Completa los datos de la tarjeta.',
            'phone.*' => 'Escribe el celular de 9 dígitos asociado a la billetera.',
            'paypal_order_id.required_if' => 'Completa el pago en PayPal.',
        ])->validate();
    }

    public function __invoke(string $token, array $payment): array
    {
        $result = $this->db()->transaction(function () use ($token, $payment): array {
            [$tenant, $signup] = $this->state->find($token, true);

            if (($signup['state'] ?? null) === 'pagada') {
                return ['state' => 'pagada', 'replayed' => true, 'invoice' => $signup['invoice'] ?? null];
            }

            if (($signup['state'] ?? null) === 'prueba') {
                throw ApiException::conflict('SIGNUP_IS_TRIAL', 'Esta alta es una prueba gratuita: no hay nada que pagar.');
            }

            $plan = $this->db()->table('plans')->where('code', $signup['plan'])->first() ?? throw ApiException::unprocessable('PLAN', 'El plan del alta ya no está disponible.');
            $coupon = filled($signup['coupon'] ?? null) ? $this->quote->coupon((string) $signup['coupon'], $plan, true) : null;
            $totals = $this->quote->totals($plan, (string) $signup['cycle'], $coupon, $this->quote->addons((array) ($signup['addons'] ?? []), $plan));

            if ($totals['total'] !== ($signup['totals']['total'] ?? null) || (isset($payment['expected_total']) && number_format((float) $payment['expected_total'], 2, '.', '') !== $totals['total'])) {
                $this->state->put((string) $tenant->id, [...$signup, 'totals' => $totals]);

                return ['error' => ApiException::unprocessable('SIGNUP_TOTAL_CHANGED', "El total cambió a S/ {$totals['total']}. Revisa el resumen y vuelve a pagar.", ['totals' => $totals])];
            }

            $subscription = $this->db()->table('subscriptions')->where('tenant_id', $tenant->id)->where('status', '<>', 'canceled')->first();
            $invoice = $this->invoice($signup, $subscription, $plan, $coupon, $totals);
            $charge = $this->gateway->charge($invoice->number_label, $totals['total'], 'PEN', $payment['method'], $payment);
            $attempt = (int) $this->db()->table('payment_attempts')->where('invoice_id', $invoice->id)->max('attempt_no') + 1;
            $this->db()->table('payment_attempts')->insert([
                'id' => (string) Str::uuid7(),
                'invoice_id' => $invoice->id,
                'attempt_no' => $attempt,
                'source' => 'portal',
                'result' => $charge->ok ? 'succeeded' : ($charge->status === 'pendiente' ? 'error' : 'declined'),
                'gateway_code' => mb_substr((string) ($charge->payload['code'] ?? $charge->status), 0, 40),
                'message' => mb_substr((string) ($charge->message ?? 'Aprobado'), 0, 300),
                'idempotency_key' => "signup:{$invoice->number_label}:{$attempt}",
                'created_at' => now(),
            ]);
            $base = [...$signup, 'totals' => $totals, 'invoice' => ['id' => $invoice->id, 'number' => $invoice->number_label]];

            if ($charge->status === 'pendiente') {
                $this->state->put((string) $tenant->id, SignupState::transition($base, 'pago_pendiente', ['payment' => ['method' => $payment['method'], 'qr' => $charge->payload['qr'] ?? null, 'expires_at' => $charge->payload['expires_at'] ?? null, 'reference' => $charge->externalId]]));
                $this->session->log('Alta landing', $tenant->code, 'pago_iniciado', $signup['state'] ?? null, "{$payment['method']} · {$invoice->number_label} · S/ {$totals['total']}");

                return ['state' => 'pago_pendiente', 'payment' => ['method' => $payment['method'], 'qr' => $charge->payload['qr'] ?? null, 'expires_at' => $charge->payload['expires_at'] ?? null, 'message' => $charge->message], 'invoice' => $base['invoice']];
            }

            if (! $charge->ok) {
                $this->state->put((string) $tenant->id, SignupState::transition($base, 'fallida', ['last_error' => $charge->message]));
                $this->session->log('Alta landing', $tenant->code, 'pago_rechazado', $signup['state'] ?? null, "{$payment['method']} · {$charge->message}");

                return ['error' => new ApiException(402, 'PAYMENT_DECLINED', 'PAYMENT_DECLINED', (string) $charge->message, [], ['reason' => $charge->payload['code'] ?? null])];
            }

            $this->settle($tenant, $subscription, $invoice, $signup, $coupon, $charge->payload['method_label'] ?? $payment['method'], $plan);
            $this->state->put((string) $tenant->id, SignupState::transition($base, 'pagada', ['paid_at' => now()->toIso8601String(), 'payment' => ['method' => $payment['method'], 'label' => $charge->payload['method_label'] ?? null]]));
            $this->session->log('Alta landing', $tenant->code, 'alta_pagada', $signup['state'] ?? null, "{$plan->name} · {$invoice->number_label} · S/ {$totals['total']} · {$payment['method']}");
            $this->conversions->record(TagScope::platform(), 'plan_pagado', (string) Str::uuid7(), $totals['net'], 'PEN', (bool) ($signup['marketing_consent'] ?? false), ['reference' => $tenant->code]);

            return ['state' => 'pagada', 'invoice' => $base['invoice'], 'total' => $totals['total']];
        });

        if (isset($result['error'])) {
            throw $result['error'];
        }

        if (($result['state'] ?? null) === 'pagada') {
            Entitlements::flush();
        }

        return $result;
    }

    private function invoice(array $signup, object $subscription, object $plan, ?object $coupon, array $totals): object
    {
        $existing = isset($signup['invoice']['id']) ? $this->db()->table('platform_invoices')->where('id', $signup['invoice']['id'])->whereIn('status', ['open', 'failed'])->first() : null;

        if ($existing !== null && (string) $existing->total === $totals['total']) {
            $existing->number_label = PlatformSequence::format(trim((string) $existing->series), (int) $existing->number);

            return $existing;
        }

        if ($existing !== null) {
            $this->db()->table('platform_invoices')->where('id', $existing->id)->update(['status' => 'void', 'void_reason' => 'Total del alta recalculado', 'updated_at' => now()]);
        }

        $today = Carbon::today('America/Lima');
        $end = $signup['cycle'] === 'anual' ? $today->copy()->addYearNoOverflow()->subDay() : $today->copy()->addMonthNoOverflow()->subDay();
        $months = (int) $totals['months_paid'];
        $addons = collect($totals['addons'])->map(fn (array $addon) => (object) ['addon_code' => $addon['code'], 'quantity' => $addon['quantity'], 'unit_price' => $addon['period_price']])->all();
        $issued = $this->invoicer->issue($subscription, $plan, $signup['cycle'] === 'anual' ? 'annual' : 'monthly', $today, $end, $coupon, $addons);
        $row = $this->db()->table('platform_invoices')->where('id', $issued['id'])->first();
        $row->number_label = $issued['number'];
        $row->months_paid = $months;

        return $row;
    }

    private function settle(object $tenant, object $subscription, object $invoice, array $signup, ?object $coupon, string $method, object $plan): void
    {
        $today = Carbon::today('America/Lima');
        $annual = $signup['cycle'] === 'anual';
        $end = $annual ? $today->copy()->addYearNoOverflow()->subDay() : $today->copy()->addMonthNoOverflow()->subDay();
        $this->db()->table('platform_invoices')->where('id', $invoice->id)->update(['status' => 'paid', 'paid_at' => now(), 'payment_ref' => mb_substr($method, 0, 120), 'updated_at' => now()]);
        $redemption = null;

        if ($coupon !== null) {
            $redemption = (string) Str::uuid7();
            $this->db()->table('coupon_redemptions')->insert(['id' => $redemption, 'coupon_id' => $coupon->id, 'tenant_id' => $tenant->id, 'subscription_id' => $subscription->id, 'remaining_cycles' => max(0, (int) $coupon->duration_cycles - 1), 'created_at' => now()]);
            $this->db()->table('coupons')->where('id', $coupon->id)->update(['redeemed_count' => DB::raw('redeemed_count + 1')]);
            $this->session->log('Cupón', (string) $coupon->code, 'canjear', null, "{$tenant->code} · alta desde la landing");
        }

        foreach ((array) ($signup['totals']['addons'] ?? []) as $addon) {
            $this->db()->table('subscription_items')->insert(['id' => (string) Str::uuid7(), 'subscription_id' => $subscription->id, 'addon_code' => $addon['code'], 'quantity' => $addon['quantity'], 'unit_price' => $addon['unit_price'], 'starts_at' => $today->toDateString(), 'billing_mode' => 'mensual', 'created_at' => now(), 'updated_at' => now()]);
        }

        $this->db()->table('subscriptions')->where('id', $subscription->id)->update([
            'status' => 'active',
            'cycle' => $annual ? 'annual' : 'monthly',
            'current_period_start' => $today->toDateString(),
            'current_period_end' => $end->toDateString(),
            'billing_anchor_day' => min(28, $today->day),
            'coupon_redemption_id' => $redemption,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);
        $model = Tenant::on('pgsql_platform')->find($tenant->id);

        if ($model?->isSuspended()) {
            $this->status->reactivate($model, 'Pago del alta desde la landing');
        }

        $this->db()->table('tenants')->where('id', $tenant->id)->update(['mrr' => $plan->price_month, 'updated_at' => now()]);
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
