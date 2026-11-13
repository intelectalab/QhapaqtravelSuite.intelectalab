<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Platform\Actions\ManageTenant;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Showcase\Support\FunnelRecorder;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\ShowcaseRules;
use App\Domain\Showcase\Support\ShowcaseSequence;
use Brick\Math\BigDecimal;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageAccessPasses
{
    public function __construct(
        private readonly ShowcaseSequence $sequence,
        private readonly PlatformSession $session,
        private readonly PlatformInvoicer $invoicer,
        private readonly ManageTenant $tenants,
        private readonly FunnelRecorder $funnel,
    ) {}

    public function create(array $data, PlatformUser $actor): array
    {
        $tenant = $this->db()->table('tenants')->where('code', $data['tenant'])->first() ?? throw ApiException::unprocessable('PASS-TENANT', 'Elige una agencia de la lista.', ['field' => 'tenant']);
        $features = $this->features($data['features']);
        $days = (int) $data['days'];
        $price = Decimal::money($data['price'] ?? 0);
        $plan = blank($data['convert_to'] ?? null) ? null : ($this->db()->table('plans')->where('code', $data['convert_to'])->value('id') ?? throw ApiException::unprocessable('PASS-PLAN', 'Elige el plan sugerido de la lista.', ['field' => 'convert_to']));

        try {
            $pass = $this->db()->transaction(function () use ($tenant, $features, $days, $price, $plan, $data, $actor): array {
                if ($this->db()->table('platform_access_passes')->where('tenant_id', $tenant->id)->where('status', 'activo')->lock('for no key update')->exists()) {
                    throw ApiException::conflict('VT-06', "{$tenant->commercial_name} ya tiene un pase activo. Extiéndelo o revócalo antes de crear otro.");
                }

                $code = $this->sequence->next(ShowcaseSequence::PASS);
                $starts = Carbon::today('America/Lima');
                $ends = $starts->copy()->addDays($days);
                $invoice = $price->isPositive() ? $this->invoice($tenant, $code, $price, $starts, $ends) : null;
                $this->db()->table('platform_access_passes')->insert([
                    'id' => (string) Str::uuid7(),
                    'code' => $code,
                    'tenant_id' => $tenant->id,
                    'name' => "Pase Básico {$days} días",
                    'starts_on' => $starts->toDateString(),
                    'ends_on' => $ends->toDateString(),
                    'price' => (string) $price,
                    'currency' => 'PEN',
                    'features' => PgArray::literal($features),
                    'reason' => mb_substr(trim((string) $data['reason']), 0, 200),
                    'status' => 'activo',
                    'convert_to_plan_id' => $plan,
                    'source' => $data['source'] ?? 'consola',
                    'invoice_id' => $invoice['id'] ?? null,
                    'created_by' => $actor->getKey(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $this->grant($tenant->id, $code, $features, $ends, $actor);
                $this->funnel->record('pase_iniciado', $this->db()->table('platform_showcase_agencies')->where('tenant_id', $tenant->id)->value('id'), $tenant->id);
                $this->session->log('Pase', $code, 'crear', null, "{$tenant->code} · ".count($features)." funciones · hasta {$ends->format('d/m/Y')}".($invoice ? " · {$invoice['number']}" : ' · cortesía'), $actor);

                return ['code' => $code, 'ends_on' => $ends->toDateString(), 'invoice' => $invoice['number'] ?? null];
            });
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                throw ApiException::conflict('VT-06', 'La agencia ya tiene un pase activo.');
            }

            throw $e;
        }

        Entitlements::flush();

        return $pass;
    }

    public function extend(string $code, int $days, PlatformUser $actor): array
    {
        $result = $this->db()->transaction(function () use ($code, $days, $actor): array {
            $pass = $this->active($code);
            $ends = Carbon::parse($pass->ends_on)->addDays($days);
            $total = (int) Carbon::parse($pass->starts_on)->diffInDays($ends);

            if ($total > ShowcaseRules::PASS_MAX_DAYS) {
                $left = ShowcaseRules::PASS_MAX_DAYS - (int) Carbon::parse($pass->starts_on)->diffInDays(Carbon::parse($pass->ends_on));
                throw ApiException::unprocessable('VT-06', $left > 0 ? "Este pase admite solo {$left} días más (máximo 60 en total)." : 'Este pase ya llegó al máximo de 60 días.');
            }

            $this->db()->table('platform_access_passes')->where('id', $pass->id)->update(['ends_on' => $ends->toDateString(), 'updated_at' => now()]);
            $this->db()->table('feature_overrides')->where('tenant_id', $pass->tenant_id)->where('reason', $this->reason($code))->update(['valid_until' => $ends->toDateString()]);
            $this->session->log('Pase', $code, 'extender', Carbon::parse($pass->ends_on)->format('d/m/Y'), $ends->format('d/m/Y')." · +{$days} días", $actor);

            return ['code' => $code, 'ends_on' => $ends->toDateString()];
        });
        Entitlements::flush();

        return $result;
    }

    public function convert(string $code, ?string $planCode, PlatformUser $actor): array
    {
        $pass = $this->db()->transaction(fn () => $this->active($code));
        $planCode ??= $pass->convert_to_plan_id ? (string) $this->db()->table('plans')->where('id', $pass->convert_to_plan_id)->value('code') : null;

        if (blank($planCode)) {
            throw ApiException::unprocessable('PASS-PLAN', 'Elige el plan al que pasa la agencia.', ['field' => 'plan']);
        }

        $plan = $this->db()->table('plans')->where('code', $planCode)->where('status', 'active')->first() ?? throw ApiException::unprocessable('PASS-PLAN', 'Elige un plan de la lista.', ['field' => 'plan']);
        $tenant = Tenant::on('pgsql_platform')->findOrFail($pass->tenant_id);

        try {
            $this->tenants->changePlan($tenant, (string) $plan->code, "Pase {$code} convertido", $actor);
        } catch (ApiException $e) {
            if ($e->ruleCode !== 'SAME_PLAN') {
                throw $e;
            }
        }

        $this->db()->transaction(function () use ($pass, $plan, $code, $actor): void {
            $this->db()->table('platform_access_passes')->where('id', $pass->id)->update(['status' => 'convertido', 'convert_to_plan_id' => $plan->id, 'updated_at' => now()]);
            $this->db()->table('feature_overrides')->where('tenant_id', $pass->tenant_id)->where('reason', $this->reason($code))->delete();
            $this->db()->table('tenants')->where('id', $pass->tenant_id)->whereIn('status', ['prueba', 'suspendido'])->update(['status' => 'activo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->funnel->record('plan_pagado', $this->db()->table('platform_showcase_agencies')->where('tenant_id', $pass->tenant_id)->value('id'), $pass->tenant_id);
            $this->session->log('Pase', $code, 'convertir', 'activo', "convertido · {$plan->name}", $actor);
        });
        Entitlements::flush();

        return ['code' => $code, 'status' => 'convertido', 'plan' => $plan->name];
    }

    public function revoke(string $code, ?string $reason, PlatformUser $actor): array
    {
        $this->db()->transaction(function () use ($code, $reason, $actor): void {
            $pass = $this->active($code);
            $this->db()->table('platform_access_passes')->where('id', $pass->id)->update(['status' => 'revocado', 'updated_at' => now()]);
            $this->db()->table('feature_overrides')->where('tenant_id', $pass->tenant_id)->where('reason', $this->reason($code))->delete();
            $this->session->log('Pase', $code, 'revocar', 'activo', trim('revocado'.($reason ? " · {$reason}" : '')), $actor);
        });
        Entitlements::flush();

        return ['code' => $code, 'status' => 'revocado'];
    }

    public function billing(string $addonCode, array $data, PlatformUser $actor): array
    {
        $addon = $this->db()->table('addons')->where('code', $addonCode)->first() ?? throw ApiException::notFound('El add-on no existe.');
        $mode = (string) $data['billing_mode'];
        $once = $mode === 'mensual' ? null : ($data['price_once'] ?? null);
        $month = $mode === 'unico' ? null : ($data['price_month'] ?? null);

        if ($mode !== 'mensual' && ($once === null || ! Decimal::money($once)->isPositive())) {
            throw ApiException::unprocessable('VT-07', 'Indica el precio de pago único.', ['field' => 'price_once']);
        }

        if ($mode !== 'unico' && ($month === null || ! Decimal::money($month)->isPositive())) {
            throw ApiException::unprocessable('VT-07', 'Indica el precio mensual.', ['field' => 'price_month']);
        }

        $this->db()->table('addons')->where('code', $addonCode)->update([
            'billing_mode' => $mode,
            'price_once' => $once === null ? null : (string) Decimal::money($once),
            'price_month' => $month === null ? $addon->price_month : (string) Decimal::money($month),
            'updated_at' => now(),
        ]);
        $label = ['unico' => 'pago único', 'mensual' => 'mensual', 'ambos' => 'único o mensual'][$mode];
        $this->session->log('Add-on', $addonCode, 'precio', "{$addon->billing_mode} · ".($addon->price_once ?? '—').' / '.($addon->price_month ?? '—'), "{$label} · ".($once ?? '—').' / '.($month ?? '—'), $actor);

        return ['code' => $addonCode, 'billing_mode' => $mode];
    }

    private function features(array $keys): array
    {
        $valid = $this->db()->table('features')->whereIn('key', $keys)->pluck('key')->all();
        $missing = array_diff($keys, $valid);

        if ($valid === [] || $missing !== []) {
            throw ApiException::unprocessable('VT-06', $valid === [] ? 'Elige al menos una función para el pase.' : 'Hay funciones que no existen en el catálogo.', ['field' => 'features']);
        }

        return array_values(array_unique($valid));
    }

    private function grant(string $tenantId, string $code, array $features, Carbon $ends, PlatformUser $actor): void
    {
        $taken = $this->db()->table('feature_overrides')->where('tenant_id', $tenantId)->whereIn('feature_key', $features)->pluck('feature_key')->all();

        foreach (array_diff($features, $taken) as $feature) {
            $this->db()->table('feature_overrides')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $tenantId,
                'feature_key' => $feature,
                'value' => true,
                'reason' => $this->reason($code),
                'valid_until' => $ends->toDateString(),
                'granted_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'created_at' => now(),
            ]);
        }
    }

    private function invoice(object $tenant, string $code, BigDecimal $price, Carbon $from, Carbon $to): array
    {
        $subscription = $this->db()->table('subscriptions')->where('tenant_id', $tenant->id)->where('status', '<>', 'canceled')->first()
            ?? throw ApiException::unprocessable('PASS-BILLING', 'Para cobrar el pase la agencia necesita una suscripción con datos de facturación. Créalo como cortesía (precio 0) o registra primero su suscripción.', ['field' => 'price']);

        return $this->invoicer->charge($subscription, 'manual', $from, $to, [["Pase Básico {$code} · {$from->format('d/m/Y')} al {$to->format('d/m/Y')}", 1, $price, 'addon']]);
    }

    private function active(string $code): object
    {
        $pass = $this->db()->table('platform_access_passes')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound('El pase no existe.');

        if ($pass->status !== 'activo') {
            throw ApiException::conflict('VT-06', 'El pase ya no está activo.');
        }

        return $pass;
    }

    private function reason(string $code): string
    {
        return "Pase {$code}";
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
