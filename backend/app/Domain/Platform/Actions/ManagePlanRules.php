<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlanRuleMatrix;
use App\Domain\Platform\Support\TenantNotice;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManagePlanRules
{
    private const CONNECTION = 'pgsql_platform';

    private const ENTITY = 'Plan × regla';

    public function __construct(
        private readonly PlanRuleMatrix $matrix,
        private readonly PlatformSession $session,
        private readonly TenantNotice $notice,
    ) {}

    public function change(string $ruleCode, string $planCode, bool $dryRun, PlatformUser $actor): array
    {
        $plans = $this->matrix->plans();
        $target = $plans->first(fn (object $plan) => $plan->code === Str::lower($planCode) || $plan->name === $planCode) ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.', ['field' => 'min_plan']);
        $rule = $this->matrix->rules()->firstWhere('code', Str::upper($ruleCode)) ?? throw ApiException::notFound('La regla no existe.');

        if ($rule->min_plan === $target->name) {
            throw ApiException::unprocessable('CFG-BR-01', "{$rule->name} ya se incluye desde el plan {$target->name}.");
        }

        $affected = $this->affected($plans, (string) $rule->min_plan, (string) $target->name);
        $result = [
            'rule' => ['code' => $rule->code, 'name' => $rule->name],
            'from' => $rule->min_plan,
            'to' => $target->name,
            'effect' => $this->matrix->rank($plans, $target->name) > $this->matrix->rank($plans, $rule->min_plan) ? 'lose' : 'gain',
            'affected_tenants' => $affected->map(fn (array $tenant) => ['code' => $tenant['code'], 'name' => $tenant['name'], 'plan' => $tenant['plan']])->all(),
            'dry_run' => $dryRun,
        ];

        if ($dryRun) {
            return $result;
        }

        $this->db()->transaction(function () use ($rule, $target, $actor, $affected, $result): void {
            $this->apply((string) $rule->code, (string) $target->name, $actor);
            $verb = $result['effect'] === 'lose' ? 'pierden' : 'ganan';
            $this->session->log(self::ENTITY, (string) $rule->code, 'cambiar_plan_minimo', (string) $rule->min_plan, "{$target->name} · {$affected->count()} ".($affected->count() === 1 ? 'agencia' : 'agencias')." {$verb} la regla", $actor);
        });

        $this->invalidate();
        $this->notify($affected, (string) $rule->name, (string) $target->name, $result['effect']);

        return $result;
    }

    public function reset(PlatformUser $actor): array
    {
        $plans = $this->matrix->plans();
        $rules = $this->matrix->rules()->filter(fn (object $rule) => $rule->min_plan !== $rule->default_plan)->values();

        if ($rules->isEmpty()) {
            throw ApiException::unprocessable('CFG-BR-01', 'La matriz ya está en sus valores de demostración. No hubo cambios.');
        }

        $this->db()->transaction(function () use ($rules, $actor): void {
            foreach ($rules as $rule) {
                $this->apply((string) $rule->code, (string) $rule->default_plan, $actor);
            }

            $this->session->log(self::ENTITY, 'MATRIZ', 'restablecer_demo', "{$rules->count()} ".($rules->count() === 1 ? 'regla modificada' : 'reglas modificadas'), 'matriz de demostración', $actor);
        });

        $this->invalidate();

        return ['restored' => $rules->count(), 'rules' => $rules->map(fn ($rule) => ['code' => $rule->code, 'name' => $rule->name, 'from' => $rule->min_plan, 'to' => $rule->default_plan])->values()->all(), 'plans' => $plans->count()];
    }

    private function apply(string $code, string $plan, PlatformUser $actor): void
    {
        $this->db()->table('plan_rule_entitlements')->updateOrInsert(['rule_code' => $code], ['min_plan' => $plan, 'is_demo' => true, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->db()->table('sys_booking_rules')->where('code', $code)->where('is_custom', false)->update(['min_plan' => $plan]);
    }

    private function affected(Collection $plans, string $from, string $to): Collection
    {
        $low = min($this->matrix->rank($plans, $from), $this->matrix->rank($plans, $to));
        $high = max($this->matrix->rank($plans, $from), $this->matrix->rank($plans, $to));

        return $this->matrix->tenants()->filter(fn (array $tenant) => $tenant['rank'] >= $low && $tenant['rank'] < $high)->values();
    }

    private function invalidate(): void
    {
        foreach ($this->db()->table('tenants')->pluck('id') as $id) {
            RuleResolver::invalidate((string) $id);
        }
    }

    private function notify(Collection $tenants, string $rule, string $plan, string $effect): void
    {
        $body = $effect === 'lose'
            ? "Desde hoy la regla de reserva «{$rule}» se incluye a partir del plan {$plan}. Tu plan actual ya no la incluye: el motor de reservas deja de aplicarla aunque la tengas activada. Conservamos su configuración por si cambias de plan."
            : "Desde hoy la regla de reserva «{$rule}» se incluye a partir del plan {$plan}, que ya tienes. Puedes activarla desde Configuración, Reglas de reserva.";

        foreach ($tenants as $tenant) {
            $this->notice->send($tenant['id'], 'Cambio en las reglas incluidas en tu plan', $body);
        }
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
