<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\TenantNotice;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class StartTrial
{
    public const MIN_DAYS = 7;

    public const MAX_DAYS = 60;

    private const CONNECTION = 'pgsql_platform';

    private const TIMEZONE = 'America/Lima';

    public function __construct(
        private readonly PlatformSession $session,
        private readonly TenantNotice $notice,
    ) {}

    public function __invoke(string $tenantCode, ?string $planCode, ?int $days, string $reason, PlatformUser $actor): array
    {
        $result = $this->db()->transaction(function () use ($tenantCode, $planCode, $days, $reason, $actor): array {
            $tenant = $this->db()->table('tenants')->where('code', $tenantCode)->lockForUpdate()->first(['id', 'code', 'commercial_name', 'status', 'plan_id', 'ruc', 'legal_name', 'fiscal_address', 'admin_email'])
                ?? throw ApiException::notFound('La agencia no existe.');

            if ($tenant->status === 'suspendido') {
                throw ApiException::conflict('TENANT_SUSPENDED', 'La agencia está suspendida. Reactívala antes de darle una prueba.');
            }

            $subscription = $this->db()->table('subscriptions')->where('tenant_id', $tenant->id)->where('status', '<>', 'canceled')->lockForUpdate()->first();
            $this->assertEligible($subscription);
            $plan = $this->plan($planCode, $subscription->plan_id ?? $tenant->plan_id);
            $length = $days ?? ((int) $plan->trial_days ?: 14);
            $today = Carbon::today(self::TIMEZONE);
            $ends = $today->copy()->addDays($length);
            $values = [
                'plan_id' => $plan->id,
                'status' => 'trialing',
                'trial_starts_at' => $today->toDateString(),
                'trial_ends_at' => $ends->toDateString(),
                'trial_extended_days' => 0,
                'current_period_start' => $today->toDateString(),
                'current_period_end' => $ends->toDateString(),
                'billing_anchor_day' => min(28, $today->day),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];

            if ($subscription === null) {
                $this->db()->table('subscriptions')->insert([
                    ...$values,
                    'id' => (string) Str::uuid7(),
                    'code' => $this->code($tenant->code, $today),
                    'tenant_id' => $tenant->id,
                    'cycle' => 'monthly',
                    'gateway' => 'local_gateway',
                    'billing_ruc' => $tenant->ruc,
                    'billing_name' => $tenant->legal_name,
                    'billing_address' => $tenant->fiscal_address,
                    'billing_email' => $tenant->admin_email,
                    'created_by' => $actor->getKey(),
                    'created_at' => now(),
                ]);
            } else {
                $this->db()->table('subscriptions')->where('id', $subscription->id)->update([...$values, 'lock_version' => DB::raw('lock_version + 1')]);
            }

            $this->db()->table('tenants')->where('id', $tenant->id)->update([
                'status' => 'prueba',
                'plan_id' => $plan->id,
                'trial_ends_at' => $ends->copy()->endOfDay()->utc(),
                'mrr' => 0,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $before = $subscription === null ? 'sin suscripción' : 'prueba vencida · solo lectura';
            $this->session->log('Tenant', $tenant->code, 'iniciar_trial', $before, "prueba {$plan->name} · {$length} días · hasta {$ends->format('d/m/Y')} · ".mb_substr($reason, 0, 120), $actor);

            return [
                'tenant_id' => (string) $tenant->id,
                'tenant' => ['code' => $tenant->code, 'name' => $tenant->commercial_name],
                'plan' => ['code' => $plan->code, 'name' => $plan->name],
                'status' => 'trialing',
                'starts_at' => $today->toDateString(),
                'ends_at' => $ends->toDateString(),
                'days' => $length,
            ];
        });

        Entitlements::flush();
        $this->notice->send($result['tenant_id'], 'Tu prueba de KipuControl está activa', "Activamos una prueba del plan {$result['plan']['name']} por {$result['days']} días, hasta el ".Carbon::parse($result['ends_at'])->format('d/m/Y').". Durante la prueba tienes todas sus funciones.\n\nAntes de que termine, registra tu tarjeta en Administración, Suscripción y uso para seguir sin interrupciones.");
        unset($result['tenant_id']);

        return $result;
    }

    public static function eligible(): Collection
    {
        return DB::connection(self::CONNECTION)->table('tenants as t')
            ->leftJoin('subscriptions as s', fn ($join) => $join->on('s.tenant_id', '=', 't.id')->where('s.status', '<>', 'canceled'))
            ->leftJoin('plans as p', 'p.id', '=', 't.plan_id')
            ->where('t.status', '<>', 'suspendido')
            ->where(fn ($query) => $query->whereNull('s.id')->orWhere(fn ($lapsed) => $lapsed->where('s.status', 'suspended')->whereNotNull('s.trial_ends_at')))
            ->orderBy('t.commercial_name')
            ->get(['t.code', 't.commercial_name', 's.id as subscription_id', 'p.code as plan_code'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->commercial_name,
                'plan' => $row->plan_code,
                'reason' => $row->subscription_id === null ? 'Sin suscripción' : 'Prueba vencida en solo lectura',
            ])->values();
    }

    private function assertEligible(?object $subscription): void
    {
        if ($subscription === null || ($subscription->status === 'suspended' && $subscription->trial_ends_at !== null)) {
            return;
        }

        throw match ($subscription->status) {
            'trialing' => ApiException::conflict('TRIAL_ACTIVE', 'La agencia ya está en prueba. Si necesita más días, usa Extender prueba.'),
            'suspended' => ApiException::conflict('SUBSCRIPTION_PENDING', 'La agencia tiene una suscripción pendiente de pago. Regístrale el pago en lugar de darle una prueba.'),
            default => ApiException::conflict('SUBSCRIPTION_ACTIVE', 'La agencia ya tiene una suscripción pagada. Para que pruebe otro plan, cámbiale el plan.'),
        };
    }

    private function plan(?string $code, ?string $currentId): object
    {
        $query = $this->db()->table('plans')->where('status', 'active');
        $plan = $code !== null ? $query->where('code', $code)->first() : ($currentId ? $query->where('id', $currentId)->first() : null);

        return $plan ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.', ['field' => 'plan']);
    }

    private function code(string $tenantCode, Carbon $today): string
    {
        $base = 'SUB-'.$today->year.'-'.substr($tenantCode, -4);
        $taken = $this->db()->table('subscriptions')->where('code', 'like', "{$base}%")->pluck('code')->all();

        if (! in_array($base, $taken, true)) {
            return $base;
        }

        $next = 2;

        while (in_array("{$base}-{$next}", $taken, true)) {
            $next++;
        }

        return "{$base}-{$next}";
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
