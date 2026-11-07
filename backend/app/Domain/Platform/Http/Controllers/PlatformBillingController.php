<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Platform\Actions\ManageCoupon;
use App\Domain\Platform\Actions\ManageEntitlements;
use App\Domain\Platform\Actions\ManageTrial;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\BillingDirectory;
use App\Domain\Platform\Support\BillingMetrics;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class PlatformBillingController
{
    private const MANUAL_METHODS = ['Transferencia bancaria', 'Depósito en cuenta', 'Yape o Plin empresarial'];

    public function metrics(BillingMetrics $metrics): JsonResponse
    {
        return response()->json(['data' => $metrics->overview()]);
    }

    public function invoices(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->invoices()]);
    }

    public function invoice(string $id, BillingDirectory $directory): JsonResponse
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La factura no existe.');
        }

        return response()->json(['data' => $directory->invoice($id) ?? throw ApiException::notFound('La factura no existe.')]);
    }

    public function retry(string $id, Request $request, CollectInvoice $collect, BillingDirectory $directory): JsonResponse
    {
        $charge = $collect->retry($id, $this->user($request));

        return response()->json(['data' => ['result' => $charge['result'], 'message' => $charge['message'], 'invoice' => $directory->invoice($id)]]);
    }

    public function manualPayment(string $id, Request $request, CollectInvoice $collect, BillingDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', Rule::in(self::MANUAL_METHODS)],
            'reference' => ['required', 'string', 'min:4', 'max:60'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
        ], [
            'method.required' => 'Elige cómo pagó la agencia.',
            'method.in' => 'Elige un medio de pago de la lista.',
            'reference.required' => 'Escribe el número de operación.',
            'reference.min' => 'El número de operación es muy corto.',
            'paid_on.required' => 'Indica la fecha del pago.',
            'paid_on.before_or_equal' => 'La fecha del pago no puede ser futura.',
        ]);
        $collect->manualPayment($id, $data, $this->user($request));

        return response()->json(['data' => $directory->invoice($id)]);
    }

    public function void(string $id, Request $request, CollectInvoice $collect): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:300']], [
            'reason.required' => 'Explica por qué se anula la factura.',
            'reason.min' => 'Explica el motivo con un poco más de detalle.',
        ]);

        return response()->json(['data' => ['credit_note' => $collect->void($id, $data['reason'], $this->user($request))]]);
    }

    public function extend(string $id, Request $request, CollectInvoice $collect): JsonResponse
    {
        $collect->extend($id, $this->user($request));

        return response()->json(['data' => ['extended' => true]]);
    }

    public function suspend(string $id, Request $request, CollectInvoice $collect): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.required' => 'Escribe el motivo de la suspensión.', 'reason.min' => 'Explica el motivo con un poco más de detalle.']);
        $collect->suspendTenant($id, $data['reason'], $this->user($request));

        return response()->json(['data' => ['suspended' => true]]);
    }

    public function dunning(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->dunning()]);
    }

    public function dunningPolicy(Request $request, ManageEntitlements $manage, BillingDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'retry_days' => ['required', 'array', 'min:1', 'max:5'],
            'retry_days.*' => ['required', 'integer', 'min:1', 'max:30'],
            'suspend_after_last' => ['required', 'boolean'],
        ], [
            'retry_days.required' => 'Indica al menos un día de reintento.',
            'retry_days.max' => 'La política admite hasta cinco reintentos.',
            'retry_days.*.integer' => 'Los días de reintento son números enteros.',
            'retry_days.*.min' => 'El primer reintento es como mínimo al día siguiente.',
            'retry_days.*.max' => 'Un reintento no puede ser después del día 30.',
        ]);
        $manage->updateDunningPolicy($data, $this->user($request));

        return response()->json(['data' => $directory->dunning()['policy']]);
    }

    public function trials(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->trials()]);
    }

    public function extendTrial(string $tenant, Request $request, ManageTrial $trials): JsonResponse
    {
        $data = $request->validate(['days' => ['required', 'integer', Rule::in([7, 14])]], ['days.in' => 'La extensión es de 7 o 14 días.']);
        $trials->extend($tenant, (int) $data['days'], $this->user($request));

        return response()->json(['data' => ['extended' => true]]);
    }

    public function convertTrial(string $tenant, Request $request, ManageTrial $trials): JsonResponse
    {
        $data = $request->validate(['coupon' => ['nullable', 'string', 'max:20']]);

        return response()->json(['data' => ['invoice' => $trials->convert($tenant, $data['coupon'] ?? null, $this->user($request))['number']]]);
    }

    public function coupons(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->coupons()]);
    }

    public function storeCoupon(Request $request, ManageCoupon $coupons): JsonResponse
    {
        $request->merge(['code' => Str::upper(trim((string) $request->input('code')))]);
        $data = $request->validate(['code' => ['required', 'regex:/^[A-Z0-9_-]{4,20}$/'], ...$this->couponRules()], [
            'code.required' => 'Escribe el código del cupón.',
            'code.regex' => 'El código usa de 4 a 20 letras, números, guiones o guiones bajos, sin espacios.',
            ...$this->couponMessages(),
        ]);

        return response()->json(['data' => ['code' => $coupons->create(['code' => $data['code'], ...$this->couponData($data)], $this->user($request))]], 201);
    }

    public function updateCoupon(string $code, Request $request, ManageCoupon $coupons): JsonResponse
    {
        $data = $request->validate($this->couponRules(), $this->couponMessages());
        $coupons->update($code, $this->couponData($data), $this->user($request));

        return response()->json(['data' => ['code' => Str::upper($code)]]);
    }

    public function couponStatus(string $code, Request $request, ManageCoupon $coupons): JsonResponse
    {
        $data = $request->validate(['active' => ['required', 'boolean']]);
        $coupons->setStatus($code, (bool) $data['active'], $this->user($request));

        return response()->json(['data' => ['code' => Str::upper($code)]]);
    }

    public function flags(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->flags()]);
    }

    public function planFeature(string $feature, string $plan, Request $request, ManageEntitlements $manage): JsonResponse
    {
        $data = $request->validate(['value' => ['nullable', 'string', 'max:20']]);
        $manage->setPlanFeature($feature, $plan, isset($data['value']) && $data['value'] !== '' ? $data['value'] : null, $this->user($request));

        return response()->json(['data' => ['feature' => $feature, 'plan' => $plan]]);
    }

    public function storeOverride(Request $request, ManageEntitlements $manage): JsonResponse
    {
        $data = $request->validate([
            'tenant' => ['required', 'string', 'max:20'],
            'feature' => ['required', 'string', 'max:50'],
            'value' => ['required', 'boolean'],
            'reason' => ['required', 'string', 'min:10', 'max:300'],
            'valid_until' => ['required', 'date'],
        ], [
            'tenant.required' => 'Elige la agencia.',
            'feature.required' => 'Elige la funcionalidad.',
            'reason.required' => 'Explica el motivo de la excepción.',
            'reason.min' => 'Explica el motivo con un poco más de detalle.',
            'valid_until.required' => 'Indica hasta cuándo rige la excepción.',
        ]);
        $manage->createOverride($data, $this->user($request));

        return response()->json(['data' => ['saved' => true]], 201);
    }

    public function deleteOverride(string $id, Request $request, ManageEntitlements $manage): JsonResponse
    {
        $manage->deleteOverride($id, $this->user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function usage(BillingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->usage()]);
    }

    private function couponRules(): array
    {
        return [
            'type' => ['required', Rule::in(['percent', 'fixed'])],
            'value' => ['required', 'numeric', 'gt:0', Rule::when(fn ($input) => $input['type'] === 'percent', ['max:50'])],
            'duration_cycles' => ['required', 'integer', 'min:1', 'max:12'],
            'plans' => ['required', 'array', 'min:1'],
            'plans.*' => ['string', Rule::in(['starter', 'professional', 'enterprise'])],
            'max_redemptions' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:today'],
            'note' => ['nullable', 'string', 'max:200'],
        ];
    }

    private function couponMessages(): array
    {
        return [
            'type.required' => 'Elige el tipo de descuento.',
            'value.required' => 'Escribe el valor del descuento.',
            'value.gt' => 'El descuento debe ser mayor que cero.',
            'value.max' => 'Un descuento porcentual puede ser como máximo del 50 %.',
            'duration_cycles.min' => 'El cupón dura al menos un ciclo.',
            'duration_cycles.max' => 'El cupón dura como máximo 12 ciclos.',
            'plans.required' => 'Elige al menos un plan.',
            'valid_to.after_or_equal' => 'La vigencia no puede terminar en el pasado.',
        ];
    }

    private function couponData(array $data): array
    {
        return [
            'type' => $data['type'],
            'value' => (float) $data['value'],
            'duration_cycles' => (int) $data['duration_cycles'],
            'plans' => array_values($data['plans']),
            'max_redemptions' => isset($data['max_redemptions']) ? (int) $data['max_redemptions'] : null,
            'valid_to' => $data['valid_to'] ?? null,
            'note' => isset($data['note']) ? trim($data['note']) : null,
        ];
    }

    private function user(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.');
        }

        return $user;
    }
}
