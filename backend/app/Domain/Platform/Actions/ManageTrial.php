<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\BillingDirectory;
use App\Domain\Platform\Support\PlatformSequence;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageTrial
{
    private const CONNECTION = 'pgsql_platform';

    private const MAX_EXTENSION = 14;

    public function __construct(
        private readonly PlatformSession $session,
        private readonly PlatformSequence $sequence,
        private readonly PlatformSettings $settings,
        private readonly BillingDirectory $directory,
    ) {}

    public function extend(string $tenantCode, int $days, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($tenantCode, $days, $actor): void {
            $subscription = $this->trial($tenantCode);
            $total = (int) $subscription->trial_extended_days + $days;

            if ($total > self::MAX_EXTENSION) {
                $left = self::MAX_EXTENSION - (int) $subscription->trial_extended_days;
                throw ApiException::unprocessable('SUB-BR-10', $left > 0 ? "Esta prueba solo admite {$left} días más de extensión (máximo 14 en total)." : 'Esta prueba ya usó los 14 días de extensión permitidos.');
            }

            $ends = Carbon::parse($subscription->trial_ends_at, 'America/Lima')->addDays($days);
            $this->db()->table('subscriptions')->where('id', $subscription->id)->update([
                'trial_ends_at' => $ends->toDateString(),
                'trial_extended_days' => $total,
                'current_period_end' => $ends->toDateString(),
                'updated_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
            ]);
            $this->db()->table('tenants')->where('id', $subscription->tenant_id)->update(['trial_ends_at' => $ends->copy()->endOfDay()->utc(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->session->log('Tenant', $tenantCode, 'extender_trial', Carbon::parse($subscription->trial_ends_at)->format('d/m/Y'), $ends->format('d/m/Y')." · +{$days} días", $actor);
        });
    }

    public function convert(string $tenantCode, ?string $couponCode, PlatformUser $actor): string
    {
        return $this->db()->transaction(function () use ($tenantCode, $couponCode, $actor): string {
            $subscription = $this->trial($tenantCode);
            $plan = $this->db()->table('plans')->where('id', $subscription->plan_id)->first();
            $coupon = $couponCode ? $this->coupon($couponCode, $subscription) : null;
            $today = Carbon::today('America/Lima');
            $end = $today->copy()->addMonthNoOverflow()->subDay();
            $price = $subscription->cycle === 'annual' ? (float) $plan->price_year : (float) $plan->price_month;
            $redemption = null;

            if ($coupon) {
                $redemption = (string) Str::uuid7();
                $this->db()->table('coupon_redemptions')->insert(['id' => $redemption, 'coupon_id' => $coupon->id, 'tenant_id' => $subscription->tenant_id, 'subscription_id' => $subscription->id, 'remaining_cycles' => max(0, (int) $coupon->duration_cycles - 1), 'created_at' => now()]);
                $this->db()->table('coupons')->where('id', $coupon->id)->increment('redeemed_count');
            }

            $this->db()->table('subscriptions')->where('id', $subscription->id)->update([
                'status' => 'active',
                'current_period_start' => $today->toDateString(),
                'current_period_end' => $end->toDateString(),
                'billing_anchor_day' => min(28, $today->day),
                'coupon_redemption_id' => $redemption,
                'updated_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
            ]);
            $this->db()->table('tenants')->where('id', $subscription->tenant_id)->update(['status' => 'activo', 'mrr' => $plan->price_month, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            $number = $this->invoice($subscription, $plan, $price, $coupon, $today, $end);
            $this->session->log('Tenant', $tenantCode, 'convertir_trial', 'prueba', trim("activo · {$plan->name}".($coupon ? " · cupón {$coupon->code}" : '')." · {$number}"), $actor);

            return $number;
        });
    }

    private function invoice(object $subscription, object $plan, float $price, ?object $coupon, Carbon $from, Carbon $to): string
    {
        $lines = [['description' => "Suscripción plan {$plan->name} — periodo {$from->locale('es')->translatedFormat('d M Y')} al {$to->locale('es')->translatedFormat('d M Y')}", 'quantity' => 1, 'unit_price' => $price, 'amount' => $price, 'line_type' => 'plan']];

        if ($coupon) {
            $discount = round($coupon->type === 'percent' ? $price * (float) $coupon->value / 100 : min($price, (float) $coupon->value), 2);
            $lines[] = ['description' => "Cupón {$coupon->code} · {$this->directory->couponLabel($coupon)}", 'quantity' => 1, 'unit_price' => -$discount, 'amount' => -$discount, 'line_type' => 'discount'];
        }

        $subtotal = round(array_sum(array_column($lines, 'amount')), 2);
        $igv = round($subtotal * $this->settings->igv() / 100, 2);
        $number = $this->sequence->next(PlatformSequence::INVOICE);
        $id = (string) Str::uuid7();
        $this->db()->table('platform_invoices')->insert([
            'id' => $id,
            'series' => 'FQ01',
            'number' => $number,
            'tenant_id' => $subscription->tenant_id,
            'subscription_id' => $subscription->id,
            'kind' => 'subscription',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'issue_date' => $from->toDateString(),
            'due_date' => $from->copy()->addDays(7)->toDateString(),
            'currency' => 'PEN',
            'subtotal' => $subtotal,
            'igv' => $igv,
            'total' => round($subtotal + $igv, 2),
            'igv_pct' => $this->settings->igv(),
            'status' => 'open',
            'bill_to' => json_encode(['name' => $subscription->billing_name, 'ruc' => $subscription->billing_ruc, 'address' => $subscription->billing_address, 'ubigeo' => $subscription->billing_ubigeo], JSON_UNESCAPED_UNICODE),
            'sunat_status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($lines as $line) {
            $this->db()->table('platform_invoice_lines')->insert(['invoice_id' => $id, ...$line]);
        }

        return PlatformSequence::format('FQ01', $number);
    }

    private function coupon(string $code, object $subscription): object
    {
        $coupon = $this->db()->table('coupons')->where('code', Str::upper(trim($code)))->lockForUpdate()->first();
        $plans = $coupon ? ($coupon->plan_ids === '{}' ? [] : explode(',', trim((string) $coupon->plan_ids, '{}'))) : [];
        $problem = match (true) {
            $coupon === null => 'El cupón no existe.',
            $coupon->status !== 'active' => 'El cupón está desactivado.',
            $coupon->valid_to !== null && Carbon::parse($coupon->valid_to, 'America/Lima')->lt(Carbon::today('America/Lima')) => 'El cupón ya venció.',
            $coupon->max_redemptions !== null && (int) $coupon->redeemed_count >= (int) $coupon->max_redemptions => 'El cupón ya no tiene canjes disponibles.',
            $plans !== [] && ! in_array($subscription->plan_id, $plans, true) => 'El cupón no aplica al plan de esta agencia.',
            $this->db()->table('coupon_redemptions')->where('coupon_id', $coupon->id)->where('tenant_id', $subscription->tenant_id)->exists() => 'La agencia ya usó este cupón.',
            default => null,
        };

        if ($problem !== null) {
            throw ApiException::unprocessable('COUPON_INVALID', $problem);
        }

        return $coupon;
    }

    private function trial(string $tenantCode): object
    {
        $subscription = $this->db()->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->where('t.code', $tenantCode)->where('s.status', '<>', 'canceled')
            ->lockForUpdate()->first(['s.*']);

        if ($subscription === null) {
            throw ApiException::notFound('La agencia no tiene una suscripción.');
        }

        if ($subscription->status !== 'trialing') {
            throw ApiException::conflict('NOT_TRIALING', 'La agencia ya no está en periodo de prueba.');
        }

        return $subscription;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
