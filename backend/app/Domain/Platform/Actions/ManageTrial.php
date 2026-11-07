<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformInvoicer;
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
        private readonly PlatformInvoicer $invoicer,
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

    public function convert(string $tenantCode, ?string $couponCode, ?PlatformUser $actor = null): array
    {
        return $this->db()->transaction(function () use ($tenantCode, $couponCode, $actor): array {
            $subscription = $this->trial($tenantCode);
            $plan = $this->db()->table('plans')->where('id', $subscription->plan_id)->first();
            $coupon = $couponCode ? $this->coupon($couponCode, $subscription) : null;
            $today = Carbon::today('America/Lima');
            $end = ($subscription->cycle === 'annual' ? $today->copy()->addYearNoOverflow() : $today->copy()->addMonthNoOverflow())->subDay();
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
            $this->db()->table('tenants')->where('id', $subscription->tenant_id)->update(['status' => 'activo', 'mrr' => $plan->price_month, 'updated_by' => $actor?->getKey(), 'updated_at' => now()]);

            $invoice = $this->invoicer->issue($subscription, $plan, (string) $subscription->cycle, $today, $end, $coupon);
            $this->session->log('Tenant', $tenantCode, 'convertir_trial', 'prueba', trim("activo · {$plan->name}".($coupon ? " · cupón {$coupon->code}" : '')." · {$invoice['number']}"), $actor);

            return $invoice;
        });
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
