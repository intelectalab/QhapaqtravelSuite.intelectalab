<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Admin\Actions\ManageSubscription;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\DowngradeValidator;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageTenant
{
    private const CONNECTION = 'pgsql_platform';

    private const FIELDS = ['commercial_name' => 'Nombre comercial', 'legal_name' => 'Razón social', 'ruc' => 'RUC', 'fiscal_address' => 'Domicilio fiscal', 'business_type' => 'Tipo de negocio', 'subdomain' => 'Subdominio'];

    private const REGIONAL = ['country' => 'País', 'locale' => 'Idioma', 'base_currency' => 'Moneda base', 'alt_currency' => 'Moneda alterna', 'timezone' => 'Zona horaria'];

    private const CYCLES = ['monthly' => 'mensual', 'annual' => 'anual'];

    public function __construct(
        private readonly PlatformSession $session,
        private readonly DowngradeValidator $downgrades,
        private readonly ManageSubscription $subscriptions,
        private readonly TenantContext $context,
    ) {}

    public function previewPlan(Tenant $tenant, string $planCode, ?string $cycle, ?string $effective): array
    {
        $subscription = $this->subscription($tenant) ?? throw ApiException::conflict('NO_SUBSCRIPTION', 'La agencia no tiene una suscripción vigente.');
        $this->assertChanges($subscription, $planCode, $cycle);

        return $this->asTenant($tenant, fn (): array => $this->subscriptions->fromPlatform()->preview($planCode, $cycle ?? (string) $subscription->cycle, $effective));
    }

    public function changePlan(Tenant $tenant, string $planCode, ?string $reason, PlatformUser $actor, ?string $cycle = null, ?string $effective = null): array
    {
        $subscription = $this->subscription($tenant);

        if ($subscription === null) {
            return $this->changeWithoutSubscription($tenant, $planCode, $reason, $actor);
        }

        $this->assertChanges($subscription, $planCode, $cycle);
        $result = $this->asTenant($tenant, fn (): array => $this->subscriptions->fromPlatform()->change($planCode, $cycle ?? (string) $subscription->cycle, null, (string) $actor->getKey(), $effective));
        $before = "{$result['from']['name']} · ".(self::CYCLES[$result['from']['cycle']] ?? $result['from']['cycle']);
        $after = "{$result['plan']['name']} · ".(self::CYCLES[$result['cycle']] ?? $result['cycle']).($result['immediate'] ? '' : " · desde {$result['effective_at']}").($reason ? " · {$reason}" : '');
        $this->session->log('Tenant', $tenant->code, $result['action'], $before, $after, $actor);

        return $result;
    }

    public function voidScheduledPlan(Tenant $tenant, PlatformUser $actor): void
    {
        $subscription = $this->subscription($tenant) ?? throw ApiException::notFound('No hay un cambio de plan programado.');
        $change = DB::connection(self::CONNECTION)->table('subscription_changes')->where('subscription_id', $subscription->id)->where('status', 'scheduled')->whereIn('kind', ['upgrade', 'downgrade', 'cycle'])->first();
        $this->asTenant($tenant, fn () => $this->subscriptions->fromPlatform()->voidScheduled(null));
        $plan = (string) DB::connection(self::CONNECTION)->table('plans')->where('id', $change?->to_plan_id)->value('name');
        $this->session->log('Tenant', $tenant->code, 'anular_cambio_programado', trim("{$plan} · ".(self::CYCLES[$change?->to_cycle] ?? '')." · desde {$change?->effective_at}"), null, $actor);
    }

    private function assertChanges(object $subscription, string $planCode, ?string $cycle): void
    {
        $plan = DB::connection(self::CONNECTION)->table('plans')->where('code', $planCode)->first() ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.');

        if ($plan->id === $subscription->plan_id && ($cycle ?? $subscription->cycle) === $subscription->cycle) {
            throw ApiException::conflict('SAME_PLAN', "La agencia ya está en el plan {$plan->name}. No hubo cambios.");
        }
    }

    private function asTenant(Tenant $tenant, callable $fn): mixed
    {
        try {
            $this->context->set($tenant);

            return $fn();
        } finally {
            $this->context->clear();
        }
    }

    private function subscription(Tenant $tenant): ?object
    {
        return DB::connection(self::CONNECTION)->table('subscriptions')->where('tenant_id', $tenant->getKey())->where('status', '<>', 'canceled')->first();
    }

    private function changeWithoutSubscription(Tenant $tenant, string $planCode, ?string $reason, PlatformUser $actor): array
    {
        $plan = Plan::on(self::CONNECTION)->where('code', $planCode)->first() ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.');
        $current = Plan::on(self::CONNECTION)->find($tenant->plan_id);

        if ($current && $current->getKey() === $plan->getKey()) {
            throw ApiException::conflict('SAME_PLAN', "La agencia ya está en el plan {$plan->name}. No hubo cambios.");
        }

        if ($this->downgrades->isDowngrade($current?->getKey(), (string) $plan->getKey())) {
            $this->downgrades->assert((string) $tenant->getKey(), $plan);
        }

        DB::connection(self::CONNECTION)->transaction(function () use ($tenant, $plan, $current, $reason, $actor): void {
            $tenant->forceFill([
                'plan_id' => $plan->getKey(),
                'mrr' => $tenant->status === 'activo' ? $plan->price_month : $tenant->mrr,
                'updated_by' => $actor->getKey(),
            ])->save();
            $this->session->log('Tenant', $tenant->code, 'cambio_plan', $current?->name, trim($plan->name.($reason ? " · {$reason}" : '')), $actor);
        });

        Entitlements::flush();

        return ['action' => 'cambio_plan', 'immediate' => true, 'effective_at' => Carbon::today('America/Lima')->toDateString(), 'plan' => ['code' => $plan->code, 'name' => $plan->name], 'proration' => null, 'invoice' => null, 'charge' => null];
    }

    public function update(Tenant $tenant, array $data, PlatformUser $actor): void
    {
        $db = DB::connection(self::CONNECTION);
        $values = [
            'commercial_name' => trim($data['commercial_name']),
            'legal_name' => trim($data['legal_name']),
            'ruc' => $data['ruc'],
            'fiscal_address' => trim($data['fiscal_address']),
            'business_type' => $data['business_type'],
            'subdomain' => Str::lower(trim($data['subdomain'])),
            ...collect(self::REGIONAL)->keys()->filter(fn (string $field): bool => ! empty($data[$field]))->mapWithKeys(fn (string $field): array => [$field => (string) $data[$field]])->all(),
        ];

        if (($values['alt_currency'] ?? $tenant->alt_currency) === ($values['base_currency'] ?? $tenant->base_currency)) {
            throw ApiException::unprocessable('TEN-BR-05', 'La moneda alterna debe ser distinta de la moneda base.');
        }

        if (isset($values['base_currency']) && $values['base_currency'] !== (string) $tenant->base_currency
            && ($db->table('booking_reservations')->where('tenant_id', $tenant->getKey())->exists() || $db->table('fin_payments')->where('tenant_id', $tenant->getKey())->exists())) {
            throw ApiException::conflict('CFG-BR-05', 'La moneda base no se puede cambiar porque la agencia ya tiene reservas o pagos registrados.');
        }

        if ($db->table('tenants')->where('subdomain', $values['subdomain'])->where('id', '<>', $tenant->getKey())->exists()) {
            throw ApiException::unprocessable('TEN-BR-01', 'El subdominio ya está en uso por otra agencia.');
        }

        if ($db->table('tenants')->where('ruc', $values['ruc'])->where('id', '<>', $tenant->getKey())->exists()) {
            throw ApiException::unprocessable('TEN-BR-02', 'Ya existe una agencia con ese RUC.');
        }

        $changed = array_filter([...self::FIELDS, ...self::REGIONAL], fn (string $label, string $field) => array_key_exists($field, $values) && (string) $values[$field] !== (string) $tenant->getAttribute($field), ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $db->transaction(function () use ($tenant, $values, $changed, $actor): void {
            $this->syncSettings((string) $tenant->getKey(), array_intersect_key($values, $changed));
            $tenant->forceFill([...$values, 'updated_by' => $actor->getKey()])->save();
            $this->session->log('Tenant', $tenant->code, 'editar', null, implode(', ', $changed), $actor);
        });
    }

    private function syncSettings(string $tenantId, array $values): void
    {
        $sections = array_filter([
            'general' => array_filter(['lang' => $values['locale'] ?? null]),
            'currency' => array_filter(['base_currency' => $values['base_currency'] ?? null, 'alt_currency' => $values['alt_currency'] ?? null]),
        ]);

        if ($sections === []) {
            return;
        }

        $previous = $this->context->id();

        try {
            $this->runInTenant($tenantId, $sections);
        } finally {
            $previous === null ? $this->context->clear() : $this->context->set($previous);
        }
    }

    private function runInTenant(string $tenantId, array $sections): void
    {
        app(TenantDatabase::class)->run($tenantId, function () use ($sections, $tenantId): void {
            foreach ($sections as $section => $patch) {
                $row = DB::table('sys_settings')->where('tenant_id', $tenantId)->where('section', $section)->first(['values']);

                if ($row !== null) {
                    DB::table('sys_settings')->where('tenant_id', $tenantId)->where('section', $section)->update([
                        'values' => json_encode([...(array) json_decode((string) $row->values, true), ...$patch], JSON_UNESCAPED_UNICODE),
                        'updated_at' => now(),
                        'lock_version' => DB::raw('lock_version + 1'),
                    ]);
                }
            }
        });
    }
}
