<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\ManageCoupon;
use App\Domain\Platform\Actions\ManageEntitlements;
use App\Domain\Platform\Actions\UpdatePlan;
use App\Domain\Platform\Http\Requests\PlanUpdateRequest;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\BillingDirectory;
use App\Domain\Platform\Support\PlanCatalog;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class PlatformEntitlementController
{
    public function overrides(Request $request, BillingDirectory $directory): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $items = collect($directory->flags()['overrides'])
            ->when(isset($filters['tenant']), fn ($rows) => $rows->filter(fn (array $row): bool => $row['tenant']['code'] === Str::upper($filters['tenant'])))
            ->when(isset($filters['feature_key']), fn ($rows) => $rows->filter(fn (array $row): bool => $row['feature']['key'] === $filters['feature_key']))
            ->when(isset($filters['active']), fn ($rows) => $rows->filter(fn (array $row): bool => $row['active'] === filter_var($filters['active'], FILTER_VALIDATE_BOOLEAN)))
            ->values()
            ->all();

        return response()->json(CursorPage::respondItems($request, $items, ['total' => count($items)]));
    }

    public function deleteOverrides(Request $request, ManageEntitlements $manage): Response
    {
        $data = $request->validate([
            'id' => ['nullable', 'uuid', 'required_without_all:tenant,feature'],
            'tenant' => ['nullable', 'string', 'max:20', 'required_without:id'],
            'feature' => ['nullable', 'string', 'max:50', 'required_without:id'],
        ], [
            'id.*' => 'Indica la excepción que se quita.',
            'tenant.*' => 'Elige la agencia.',
            'feature.*' => 'Elige la funcionalidad.',
        ]);

        $id = $data['id'] ?? DB::connection('pgsql_platform')->table('feature_overrides as o')->join('tenants as t', 't.id', '=', 'o.tenant_id')
            ->where('t.code', Str::upper((string) $data['tenant']))->where('o.feature_key', $data['feature'])->value('o.id');

        if ($id === null) {
            throw ApiException::notFound('La agencia no tiene una excepción para esa funcionalidad.');
        }

        $manage->deleteOverride((string) $id, $this->user($request));

        return response()->noContent();
    }

    public function dunningPolicy(PlatformSettings $settings): JsonResponse
    {
        $policy = $settings->dunning();

        return response()->json(['data' => [
            ...$policy,
            'steps' => collect($policy['retry_days'])->map(fn (int $days, int $index): array => ['attempt' => $index + 1, 'label' => 'D+'.$days, 'days' => $days])->values()->all(),
        ]]);
    }

    public function planFeature(string $key, string $plan): JsonResponse
    {
        $db = DB::connection('pgsql_platform');
        $feature = $db->table('features')->where('key', $key)->first(['key', 'label', 'module', 'kind', 'addon_code']) ?? throw ApiException::notFound('La funcionalidad no existe.');
        $row = $db->table('plans')->where(Str::isUuid($plan) ? 'id' : 'code', $plan)->first(['id', 'code', 'name']) ?? throw ApiException::notFound('El plan no existe.');
        $value = $db->table('plan_features')->where('plan_id', $row->id)->where('feature_key', $feature->key)->first(['value']);

        return response()->json(['data' => [
            'feature_key' => $feature->key,
            'label' => $feature->label,
            'module' => $feature->module,
            'kind' => $feature->kind,
            'addon' => $feature->addon_code,
            'plan_id' => $row->code,
            'plan_name' => $row->name,
            'value' => $value?->value,
            'included' => $value !== null,
            'overrides' => $db->table('feature_overrides as o')->join('tenants as t', 't.id', '=', 'o.tenant_id')->where('o.feature_key', $feature->key)->where('t.plan_id', $row->id)->count(),
        ]]);
    }

    public function updateCoupon(Request $request, PlatformBillingController $billing, ManageCoupon $coupons): JsonResponse
    {
        $code = Str::upper(trim((string) $request->input('code')));

        if ($code === '') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el código del cupón que se edita.');
        }

        if ($request->has('active') && array_diff(array_keys($request->all()), ['code', 'active']) === []) {
            return $billing->couponStatus($code, $request, $coupons);
        }

        return $billing->updateCoupon($code, $request, $coupons);
    }

    public function updatePlan(string $code, Request $request, PlanCatalog $catalog, UpdatePlan $update): JsonResponse
    {
        $plan = $catalog->model($code) ?? throw ApiException::notFound('El plan no existe.');
        $current = $catalog->find((string) $plan->code) ?? throw ApiException::notFound('El plan no existe.');
        $limits = [...collect($current['limits'])->all(), ...(array) $request->input('limits', [])];
        $input = [
            'price_month' => $request->input('price_month', $current['price_month']),
            'price_year' => $request->input('price_year', $current['price_year']),
            'trial_days' => $request->input('trial_days', $current['trial_days']),
            'support_level' => $request->input('support_level', $current['support_level']),
            'limits' => collect(PlanCatalog::METRICS)->mapWithKeys(fn (string $metric): array => [$metric => $limits[$metric] ?? null])->all(),
        ];
        $rules = new PlanUpdateRequest;
        $data = Validator::make($input, $rules->rules(), $rules->messages())->validate();
        $update($plan, $data, $this->user($request));

        return response()->json(['data' => $catalog->find((string) $plan->code)]);
    }

    private function user(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden('PLATFORM_ONLY', 'Esta acción es exclusiva de la consola de plataforma.');
        }

        return $user;
    }
}
