<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Actions\ChangeTenantStatus;
use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\DowngradeValidator;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\TenantNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RenewSubscriptions extends PlatformJob
{
    public const QUEUE = 'critical';

    protected function run(): string
    {
        $db = DB::connection('pgsql_platform');
        $today = $this->today()->toDateString();
        $due = $db->table('subscriptions')->whereIn('status', ['active', 'cancel_scheduled'])->where('current_period_end', '<', $today)->orderBy('current_period_end')->pluck('id');
        $count = ['renewed' => 0, 'paid' => 0, 'failed' => 0, 'canceled' => 0, 'changed' => 0, 'blocked' => 0];

        foreach ($due as $id) {
            $result = $db->transaction(fn (): ?string => $this->renew((string) $id, $today));

            if ($result === 'canceled') {
                $count['canceled']++;

                continue;
            }

            if ($result === null) {
                continue;
            }

            $count['renewed']++;
            $count['changed'] += str_contains($result, 'changed') ? 1 : 0;
            $count['blocked'] += str_contains($result, 'blocked') ? 1 : 0;
            $charge = $db->transaction(fn (): array => app(CollectInvoice::class)->collect(explode('|', $result)[0]));
            $charge['result'] === 'succeeded' ? $count['paid']++ : $count['failed']++;
        }

        $text = self::summary([
            $count['renewed'] ? self::plural($count['renewed'], 'suscripción renovada', 'suscripciones renovadas') : null,
            $count['paid'] ? self::plural($count['paid'], 'cobro aprobado', 'cobros aprobados') : null,
            $count['failed'] ? self::plural($count['failed'], 'cobro rechazado (pasa a cobranza)', 'cobros rechazados (pasan a cobranza)') : null,
            $count['changed'] ? self::plural($count['changed'], 'cambio de plan aplicado', 'cambios de plan aplicados') : null,
            $count['blocked'] ? self::plural($count['blocked'], 'bajada de plan bloqueada por el consumo', 'bajadas de plan bloqueadas por el consumo') : null,
            $count['canceled'] ? self::plural($count['canceled'], 'cancelación aplicada', 'cancelaciones aplicadas') : null,
        ], 'Sin renovaciones del día');

        return $count['failed'] + $count['blocked'] > 0 ? $this->warn($text) : $text;
    }

    private function renew(string $id, string $today): ?string
    {
        $db = DB::connection('pgsql_platform');
        $subscription = $db->table('subscriptions')->where('id', $id)->lockForUpdate()->first();

        if ($subscription === null || ! in_array($subscription->status, ['active', 'cancel_scheduled'], true) || $subscription->current_period_end >= $today) {
            return null;
        }

        if ($subscription->status === 'cancel_scheduled' || ! $subscription->auto_renew) {
            $db->table('subscriptions')->where('id', $id)->update(['status' => 'canceled', 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
            $model = Tenant::on('pgsql_platform')->find($subscription->tenant_id);

            if ($model !== null && ! $model->isSuspended()) {
                app(ChangeTenantStatus::class)->suspend($model, 'Suscripción cancelada al cierre del periodo.');
            }

            app(PlatformSession::class)->log('Suscripción', (string) $subscription->code, 'cancelar', $subscription->status, 'canceled · fin del periodo');
            app(TenantNotice::class)->send((string) $subscription->tenant_id, 'Tu suscripción terminó', 'La suscripción llegó al final del periodo y quedó cancelada, como lo pediste. Si quieres volver, escríbenos y reactivamos tu cuenta con tus datos intactos.');

            return 'canceled';
        }

        $change = $db->table('subscription_changes')->where('subscription_id', $id)->where('status', 'scheduled')->whereIn('kind', ['upgrade', 'downgrade', 'cycle'])->where('effective_at', '<=', $today)->orderBy('effective_at')->lockForUpdate()->first();
        $blocked = $change !== null ? $this->blocked($subscription, $change) : null;

        if ($blocked !== null) {
            $change = null;
        }

        $planId = $change?->to_plan_id ?: $subscription->plan_id;
        $cycle = $change?->to_cycle ?: $subscription->cycle;
        $plan = $db->table('plans')->where('id', $planId)->first();
        $from = Carbon::parse($subscription->current_period_end, 'America/Lima')->addDay();
        $to = ($cycle === 'annual' ? $from->copy()->addYearNoOverflow() : $from->copy()->addMonthNoOverflow())->subDay();
        $coupon = $this->coupon($subscription);
        $addons = $db->table('subscription_items')->where('subscription_id', $id)->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', $from->toDateString()))->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $from->toDateString()))->get(['addon_code', 'quantity', 'unit_price']);
        $invoice = app(PlatformInvoicer::class)->issue($subscription, $plan, (string) $cycle, $from, $to, $coupon, $addons);

        if ($coupon !== null) {
            $db->table('coupon_redemptions')->where('id', $subscription->coupon_redemption_id)->decrement('remaining_cycles');
        }

        if ($change !== null) {
            $db->table('subscription_changes')->where('id', $change->id)->update(['status' => 'applied', 'invoice_id' => $invoice['id']]);
            $db->table('tenants')->where('id', $subscription->tenant_id)->update(['plan_id' => $planId, 'mrr' => $plan->price_month, 'updated_at' => now()]);
            Entitlements::flush();
        }

        $db->table('subscriptions')->where('id', $id)->update([
            'plan_id' => $planId,
            'cycle' => $cycle,
            'current_period_start' => $from->toDateString(),
            'current_period_end' => $to->toDateString(),
            'updated_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
        ]);
        app(PlatformSession::class)->log('Suscripción', (string) $subscription->code, 'renovar', "{$subscription->current_period_start} → {$subscription->current_period_end}", "{$from->toDateString()} → {$to->toDateString()} · {$invoice['number']}".($change ? " · plan {$plan->name}" : ''));
        app(TenantNotice::class)->send((string) $subscription->tenant_id, "Factura {$invoice['number']} de tu suscripción", "Renovamos tu plan {$plan->name} del {$from->format('d/m/Y')} al {$to->format('d/m/Y')}. Total: S/ {$invoice['total']} (incluye IGV). Lo cobraremos con tu medio de pago registrado.");

        return $invoice['id'].($change ? '|changed' : '').($blocked !== null ? '|blocked' : '');
    }

    private function blocked(object $subscription, object $change): ?array
    {
        $validator = app(DowngradeValidator::class);

        if ($change->to_plan_id === null || ! $validator->isDowngrade((string) $subscription->plan_id, (string) $change->to_plan_id)) {
            return null;
        }

        $blockers = $validator->blockers((string) $subscription->tenant_id, (string) $change->to_plan_id);

        if ($blockers === []) {
            return null;
        }

        $plan = (string) DB::connection('pgsql_platform')->table('plans')->where('id', $change->to_plan_id)->value('name');
        DB::connection('pgsql_platform')->table('subscription_changes')->where('id', $change->id)->update(['status' => 'voided']);
        app(PlatformSession::class)->log('Suscripción', (string) $subscription->code, 'bajada_bloqueada', $plan, mb_substr(implode('; ', $blockers), 0, 250));
        app(TenantNotice::class)->send((string) $subscription->tenant_id, "No pudimos pasarte al plan {$plan}", "La bajada al plan {$plan} programada para esta renovación no se aplicó porque tu cuenta supera lo que ese plan permite:\n- ".implode("\n- ", $blockers)."\n\nSeguimos con tu plan actual. Cuando ajustes el consumo, vuelve a programar el cambio.");

        return $blockers;
    }

    private function coupon(object $subscription): ?object
    {
        if ($subscription->coupon_redemption_id === null) {
            return null;
        }

        return DB::connection('pgsql_platform')->table('coupon_redemptions as r')->join('coupons as c', 'c.id', '=', 'r.coupon_id')
            ->where('r.id', $subscription->coupon_redemption_id)->where('r.remaining_cycles', '>', 0)->first(['c.*']);
    }
}
