<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\BillingMetrics;
use App\Domain\Platform\Support\PlatformOperations;
use App\Domain\Shared\Audit\AuditCodeGenerator;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformOperationsSeeder
{
    use SeedsTenant;

    private ?string $operator = null;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->operator = DB::table('platform_users')->where('email', 'ops@kipucontrol.com')->value('id');
        $this->jobs();
        $this->audit();
    }

    private function jobs(): void
    {
        $now = Carbon::now('America/Lima');

        foreach (PlatformOperations::JOBS as $code => [$command, $name, , $cron, $label, $queue]) {
            [$last, $next] = $this->schedule($cron, $now);
            [$status, $result] = $this->result($code, $last);
            $values = [
                'name' => $name,
                'job_class' => $command,
                'cron' => $cron,
                'cron_label' => $label,
                'queue' => $queue,
                'last_run_at' => $last->copy()->utc(),
                'next_run_at' => $next->copy()->utc(),
                'last_status' => $status,
                'last_result' => $result,
                'is_system' => true,
                'updated_at' => now(),
            ];
            $id = DB::table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', $code)->value('id');

            if ($id) {
                DB::table('sys_scheduled_jobs')->where('id', $id)->update($values);
            } else {
                $id = (string) Str::uuid7();
                DB::table('sys_scheduled_jobs')->insert(['id' => $id, 'tenant_id' => null, 'code' => $code, 'paused' => false, 'created_at' => now(), ...$values]);
            }

            for ($day = 0; $day < 3; $day++) {
                $at = $last->copy()->subDays($day * ($cron === '0 9 1 * *' ? 30 : 1));
                $correlation = 'seed-'.strtolower($code).'-'.$day;
                DB::table('sys_job_runs')->where('scheduled_job_id', $id)->where('correlation_id', $correlation)->delete();
                [$runStatus, $runResult] = $day === 0 ? [$status, $result] : $this->result($code, $at);
                DB::table('sys_job_runs')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => null,
                    'scheduled_job_id' => $id,
                    'job_class' => $command,
                    'trigger' => 'schedule',
                    'status' => $runStatus,
                    'result' => $runResult,
                    'started_at' => $at->copy()->utc(),
                    'finished_at' => $at->copy()->utc()->addMilliseconds(600 + crc32($correlation) % 4200),
                    'attempt' => 1,
                    'correlation_id' => $correlation,
                ]);
            }
        }
    }

    private function schedule(string $cron, Carbon $now): array
    {
        [$minute, $hour, $dayOfMonth] = explode(' ', $cron);

        if ($dayOfMonth !== '*') {
            $last = $now->copy()->startOfMonth()->setTime((int) $hour, (int) $minute);
            $last = $last->greaterThan($now) ? $last->subMonthNoOverflow() : $last;

            return [$last, $last->copy()->addMonthNoOverflow()];
        }

        $last = $now->copy()->setTime((int) $hour, (int) $minute);
        $last = $last->greaterThan($now) ? $last->subDay() : $last;

        return [$last, $last->copy()->addDay()];
    }

    private function result(string $code, Carbon $at): array
    {
        $day = $at->toDateString();

        return match ($code) {
            'PLT-01' => $this->count(DB::table('platform_invoices')->where('issue_date', $day)->count(), 'factura emitida', 'facturas emitidas', 'Sin renovaciones del día'),
            'PLT-02' => $this->dunning($at),
            'PLT-03' => $this->count(DB::table('subscriptions')->where('status', 'trialing')->where('trial_ends_at', '<=', $at->copy()->addDays(7)->toDateString())->count(), 'aviso de prueba enviado', 'avisos de prueba enviados', 'Sin pruebas por vencer'),
            'PLT-04' => $this->count(DB::table('payment_methods')->where('status', 'expired')->count(), 'tarjeta vencida avisada', 'tarjetas vencidas avisadas', 'Sin tarjetas por vencer'),
            'PLT-05' => ['ok', DB::table('tenants')->count().' agencias consolidadas'],
            'PLT-06' => ['ok', 'MRR S/ '.number_format((float) (DB::table('platform_metrics_daily')->where('day', '<=', $day)->orderByDesc('day')->value('mrr') ?? app(BillingMetrics::class)->snapshot('pgsql_owner')['mrr']), 0, '.', ' ')],
            default => ['ok', 'Sin cambios'],
        };
    }

    private function dunning(Carbon $at): array
    {
        $declined = DB::table('payment_attempts')->where('source', 'dunning')->whereBetween('created_at', [$at->copy()->startOfDay()->utc(), $at->copy()->endOfDay()->utc()])->where('result', '<>', 'succeeded')->count();

        return $declined > 0 ? ['advertencia', $declined.($declined === 1 ? ' reintento rechazado' : ' reintentos rechazados')] : ['ok', 'Sin facturas con reintento pendiente'];
    }

    private function count(int $total, string $one, string $many, string $none): array
    {
        return ['ok', $total === 0 ? $none : $total.' '.($total === 1 ? $one : $many)];
    }

    private function audit(): void
    {
        $tenants = DB::table('tenants')->get()->keyBy('code');

        foreach (KitSeeds::read('tenants') as $row) {
            if (isset($tenants[$row['id']])) {
                $this->event('Tenant', $row['id'], 'alta', null, "{$row['plan']} · ".($row['status'] === 'prueba' ? 'en prueba' : 'activo'), Carbon::parse($tenants[$row['id']]->created_at)->toIso8601String());
            }

            if (isset($row['suspendReason'], $tenants[$row['id']])) {
                $at = $tenants[$row['id']]->suspended_at ?? null;
                $config = KitSeeds::read('platformConfig')['tenantBilling'][$row['id']] ?? [];
                $this->event('Tenant', $row['id'], 'suspender', 'activo', "suspendido · {$row['suspendReason']}", $at ? Carbon::parse($at)->toIso8601String() : $this->moment(($config['suspendedAt'] ?? '2026-08-08').' 10:00'));
            }
        }

        foreach (KitSeeds::read('platformConfig')['tenantBilling'] as $code => $billing) {
            if (! empty($billing['trialExtended']) && isset($billing['trialEnd'])) {
                $end = Carbon::parse($this->day($billing['trialEnd']));
                $this->event('Tenant', $code, 'extender_trial', $end->copy()->subDays((int) $billing['trialExtended'])->format('d/m/Y'), $end->format('d/m/Y')." · +{$billing['trialExtended']} días", $this->moment(Carbon::parse($billing['trialEnd'])->subDays((int) $billing['trialExtended'] + 2)->toDateString().' 11:20'));
            }
        }

        foreach (KitSeeds::read('coupons') as $coupon) {
            $value = $coupon['type'] === 'percent' ? "{$coupon['value']} %" : "S/ {$coupon['value']}";
            $this->event('Cupón', $coupon['code'], 'crear', null, "{$value} · {$coupon['months']} ciclos · ".implode(', ', $coupon['plans']), $this->moment($coupon['createdAt'].' 09:00'));

            if ($coupon['status'] !== 'activo') {
                $this->event('Cupón', $coupon['code'], 'desactivar', 'active', 'inactive', $this->moment($coupon['validTo'].' 18:00'));
            }
        }

        foreach (KitSeeds::read('featureFlags') as $flag) {
            foreach ($flag['overrides'] as $override) {
                $tenant = $tenants[$override['tenantId']] ?? null;

                if ($tenant) {
                    $this->event('Feature flag', "module.{$flag['key']}@{$override['tenantId']}", 'override', null, 'habilitado hasta '.Carbon::parse($this->day($override['until']))->format('d/m/Y')." · {$tenant->commercial_name} · {$override['reason']}", $this->moment($override['at']));
                }
            }
        }

        $attempts = DB::table('payment_attempts as a')->join('platform_invoices as i', 'i.id', '=', 'a.invoice_id')->where('a.result', '<>', 'succeeded')->where('a.source', '<>', 'manual_retry')
            ->get(['a.created_at', 'a.message', 'a.attempt_no', 'i.series', 'i.number']);

        foreach ($attempts as $attempt) {
            $this->event('Factura plataforma', sprintf('%s-%08d', trim($attempt->series), $attempt->number), 'cobro_rechazado', null, ($attempt->attempt_no > 1 ? 'billing:dunning' : 'billing:renewals')." · {$attempt->message}", Carbon::parse($attempt->created_at)->toIso8601String(), 'system');
        }
    }

    private function event(string $entity, string $entityId, string $action, ?string $before, string $after, ?string $at, string $actorType = 'platform_user'): void
    {
        if ($at === null || DB::table('audit_events')->whereNull('tenant_id')->where('entity', $entity)->where('entity_id', $entityId)->where('action', $action)->where('occurred_at', $at)->exists()) {
            return;
        }

        DB::table('audit_events')->insert([
            'tenant_id' => null,
            'code' => app(AuditCodeGenerator::class)->next(null, 'pgsql_owner'),
            'actor_type' => $actorType,
            'actor_id' => $actorType === 'platform_user' ? $this->operator : null,
            'actor_role' => $actorType === 'platform_user' ? 'super_admin' : null,
            'entity' => $entity,
            'entity_id' => $entityId,
            'action' => $action,
            'is_critical' => in_array($action, ['suspender', 'reactivar', 'alta', 'cambio_plan'], true),
            'before_value' => $before,
            'after_value' => $after,
            'correlation_id' => 'seed-platform',
            'occurred_at' => $at,
        ]);
    }
}
