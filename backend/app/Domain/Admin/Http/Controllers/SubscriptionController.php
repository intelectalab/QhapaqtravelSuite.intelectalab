<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageSubscription;
use App\Domain\Admin\Support\SubscriptionDirectory;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PublicPlans;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SubscriptionController
{
    public function entitlements(TenantContext $context, Entitlements $entitlements): JsonResponse
    {
        $features = $entitlements->for($context->idOrFail());

        return response()->json([
            'data' => $features,
            'meta' => ['enabled' => array_keys(array_filter($features, fn (array $feature): bool => $feature['enabled'])), 'total' => count($features)],
        ]);
    }

    public function index(Request $request, SubscriptionDirectory $directory): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $directory->overview($user)]);
    }

    public function billing(Request $request, SubscriptionDirectory $directory, AuditLogger $audit, ManageSubscription $manage): JsonResponse
    {
        if ($request->has('auto_renew') && ! $request->has('ruc')) {
            $data = $request->validate(['auto_renew' => ['required', 'boolean']], ['auto_renew.*' => 'Indica si la renovación automática queda activada.']);
            $manage->autoRenew((bool) $data['auto_renew'], IfMatch::from($request, false));

            return response()->json(['data' => ['changed' => ['auto_renew']]]);
        }

        $data = $request->validate([
            'ruc' => ['required', 'regex:/^(10|15|17|20)[0-9]{9}$/'],
            'name' => ['required', 'string', 'max:200'],
            'address' => ['required', 'string', 'max:200'],
            'ubigeo' => ['nullable', 'digits:6'],
            'email' => ['required', 'email', 'max:150'],
        ], [
            'ruc.*' => 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20 (SUB-BR-09).',
            'name.*' => 'Escribe la razón social.',
            'address.*' => 'Escribe la dirección fiscal.',
            'ubigeo.*' => 'El ubigeo tiene 6 dígitos.',
            'email.*' => 'Escribe un correo válido para recibir las facturas.',
        ]);
        $changed = $directory->updateBilling($data);

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        foreach ($changed as $key => [$old, $new]) {
            $audit->log('Suscripción', str_replace('billing_', 'facturacion.', $key), 'actualizar', TenantSettings::text($old), TenantSettings::text($new));
        }

        return response()->json(['data' => ['changed' => array_keys($changed)]]);
    }

    public function preview(Request $request, ManageSubscription $manage): JsonResponse
    {
        $data = $this->planData($request);

        return response()->json(['data' => $manage->preview($data['plan'], $data['cycle'])]);
    }

    public function change(Request $request, ManageSubscription $manage): JsonResponse
    {
        $data = $this->planData($request);

        return response()->json(['data' => $manage->change($data['plan'], $data['cycle'], IfMatch::from($request, false), (string) $this->user($request)->getKey())]);
    }

    public function voidScheduled(Request $request, ManageSubscription $manage): JsonResponse
    {
        $manage->voidScheduled(IfMatch::from($request, false));

        return response()->json(null, 204);
    }

    public function cancel(Request $request, ManageSubscription $manage): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:120'],
            'solution' => ['nullable', 'string', 'max:200'],
            'score' => ['nullable', 'integer', 'between:0,10'],
            'stay' => ['nullable', 'string', 'max:500'],
            'comments' => ['nullable', 'string', 'max:1000'],
            'export' => ['nullable', 'boolean'],
            'accept' => ['accepted'],
        ], [
            'reason.*' => 'Cuéntanos el motivo de la cancelación (SUB-BR-11).',
            'score.*' => 'El puntaje va de 0 a 10.',
            'accept.*' => 'Confirma que entiendes las condiciones de cierre.',
        ]);
        unset($data['accept']);
        $end = $manage->cancel([...$data, 'export' => (bool) ($data['export'] ?? false)], IfMatch::from($request, false), (string) $this->user($request)->getKey());

        return response()->json(['data' => ['status' => 'cancel_scheduled', 'cancel_at' => $end]]);
    }

    public function resume(Request $request, ManageSubscription $manage): JsonResponse
    {
        $manage->resume(IfMatch::from($request, false), (string) $this->user($request)->getKey());

        return response()->json(['data' => ['status' => 'active']]);
    }

    public function addAddon(Request $request, string $code, ManageSubscription $manage): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['nullable', 'integer', 'between:1,100'],
            'domain' => [$code === 'custom_domain' ? 'required' : 'nullable', 'string', 'max:190', 'regex:/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i'],
        ], ['quantity.*' => 'La cantidad va de 1 a 100.', 'domain.*' => 'Escribe el dominio sin https, por ejemplo viajes.miagencia.pe.']);

        return response()->json(['data' => $manage->addAddon($code, (int) ($data['quantity'] ?? 1), isset($data['domain']) ? strtolower($data['domain']) : null, (string) $this->user($request)->getKey())]);
    }

    public function updateAddon(Request $request, string $code, ManageSubscription $manage): JsonResponse
    {
        $data = $request->validate(['quantity' => ['required', 'integer', 'between:1,100']], ['quantity.*' => 'La cantidad va de 1 a 100.']);

        return response()->json(['data' => $manage->updateAddon($code, (int) $data['quantity'], (string) $this->user($request)->getKey())]);
    }

    public function removeAddon(Request $request, string $code, ManageSubscription $manage): JsonResponse
    {
        $manage->removeAddon($code, (string) $this->user($request)->getKey());

        return response()->json(null, 204);
    }

    public function coupon(Request $request, ManageSubscription $manage): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40']], ['code.*' => 'Escribe el código del cupón.']);

        return response()->json(['data' => $manage->redeem($data['code'], (string) $this->user($request)->getKey())]);
    }

    public function usage(Request $request, SubscriptionDirectory $directory): JsonResponse
    {
        $overview = $directory->overview($this->user($request));

        return response()->json(['data' => $overview['usage'], 'meta' => ['history' => $overview['history']]]);
    }

    public function invoices(Request $request, SubscriptionDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))['invoices']]);
    }

    public function invoice(string $number, SubscriptionDirectory $directory, ManageSubscription $manage): JsonResponse
    {
        return response()->json(['data' => $directory->invoice($manage->invoice($number))]);
    }

    public function pay(string $number, ManageSubscription $manage): JsonResponse
    {
        return response()->json(['data' => $manage->pay($number)]);
    }

    public function planRules(TenantContext $context, PublicPlans $plans): JsonResponse
    {
        $catalog = $plans->catalog();
        $planId = DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', $context->idOrFail())->where('status', '<>', 'canceled')->value('plan_id') ?? $context->tenant()->plan_id;
        $current = (string) DB::connection('pgsql_platform')->table('plans')->where('id', $planId)->value('code');

        return response()->json(['data' => ['current' => $current, 'plans' => $catalog['plans'], 'rules' => $catalog['rules']]]);
    }

    private function planData(Request $request): array
    {
        return $request->validate([
            'plan' => ['required', 'string', 'max:40'],
            'cycle' => ['required', 'in:monthly,annual'],
        ], ['plan.*' => 'Elige un plan.', 'cycle.*' => 'Elige el ciclo de pago: mensual o anual.']);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
