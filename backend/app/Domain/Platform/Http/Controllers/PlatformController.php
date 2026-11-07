<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Iam\Http\Requests\LoginRequest;
use App\Domain\Iam\Http\Requests\MfaVerifyRequest;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Platform\Actions\ChangeTenantStatus;
use App\Domain\Platform\Actions\ManageTenant;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Actions\ProvisionTenant;
use App\Domain\Platform\Actions\UpdatePlan;
use App\Domain\Platform\Http\Requests\PlanUpdateRequest;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use App\Domain\Platform\Http\Requests\TenantStatusRequest;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\PlanCatalog;
use App\Domain\Platform\Support\PlatformBranding;
use App\Domain\Platform\Support\TenantDirectory;
use App\Domain\Platform\Support\TenantHealth;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlatformController
{
    public function __construct(private readonly PlatformSession $session) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return response()->json(['data' => [...$this->session->login((string) $request->input('email'), (string) $request->input('password')), 'realm' => 'platform']]);
    }

    public function health(TenantHealth $health): JsonResponse
    {
        $rows = $health->all();

        return response()->json(['data' => $rows, 'meta' => ['kpis' => $health->kpis($rows)]]);
    }

    public function verifyMfa(MfaVerifyRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->session->verifyMfa($this->user($request), $this->token($request), (string) $request->input('code'))]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->session->logout($this->user($request), $this->token($request));

        return response()->json(['data' => ['message' => 'Cerraste sesión.']]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => ['id' => $user->getKey(), 'name' => $user->name, 'email' => $user->email, 'home' => PlatformSession::HOME, 'branding' => app(PlatformBranding::class)->current()]]);
    }

    public function tenants(TenantDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->all()]);
    }

    public function provision(TenantProvisionRequest $request, ProvisionTenant $provision): JsonResponse
    {
        $tenant = $provision($request->validated(), $this->user($request));

        return response()->json(['data' => ['code' => $tenant->code]], 201);
    }

    public function validateStep(TenantProvisionRequest $request, ProvisionTenant $provision): JsonResponse
    {
        $provision->validate($request->validated());

        return response()->json(['data' => ['valid' => true]]);
    }

    public function provisionOptions(): JsonResponse
    {
        return response()->json(['data' => ['business_types' => TenantProvisionRequest::BUSINESS_TYPES]]);
    }

    public function tenant(string $id, TenantDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($id) ?? throw ApiException::notFound('La agencia no existe.')]);
    }

    public function changePlan(string $id, Request $request, ManageTenant $manage, TenantDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'plan' => ['required', 'string', 'max:20'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], ['plan.required' => 'Elige el nuevo plan.']);
        $tenant = $directory->locate($id) ?? throw ApiException::notFound('La agencia no existe.');
        $manage->changePlan($tenant, $data['plan'], $data['reason'] ?? null, $this->user($request));

        return response()->json(['data' => $directory->find($tenant->code)]);
    }

    public function updateTenant(string $id, TenantProvisionRequest $request, ManageTenant $manage, TenantDirectory $directory): JsonResponse
    {
        $tenant = $directory->locate($id) ?? throw ApiException::notFound('La agencia no existe.');
        $manage->update($tenant, $request->validated(), $this->user($request));

        return response()->json(['data' => $directory->find($tenant->code)]);
    }

    public function plans(PlanCatalog $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->all()]);
    }

    public function plan(string $code, PlanCatalog $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->find($code) ?? throw ApiException::notFound('El plan no existe.')]);
    }

    public function updatePlan(string $code, PlanUpdateRequest $request, PlanCatalog $catalog, UpdatePlan $update): JsonResponse
    {
        $plan = $catalog->model($code) ?? throw ApiException::notFound('El plan no existe.');
        $update($plan, $request->validated(), $this->user($request));

        return response()->json(['data' => $catalog->find($plan->code)]);
    }

    public function suspend(string $id, TenantStatusRequest $request, ChangeTenantStatus $change, TenantDirectory $directory): JsonResponse
    {
        $change->suspend($this->tenantModel($id, $directory), (string) $request->input('reason'), $this->user($request));

        return response()->json(['data' => $directory->find($id)]);
    }

    public function reactivate(string $id, TenantStatusRequest $request, ChangeTenantStatus $change, TenantDirectory $directory): JsonResponse
    {
        $change->reactivate($this->tenantModel($id, $directory), (string) $request->input('reason'), $this->user($request));

        return response()->json(['data' => $directory->find($id)]);
    }

    private function tenantModel(string $id, TenantDirectory $directory): Tenant
    {
        return $directory->locate($id) ?? throw ApiException::notFound('La agencia no existe.');
    }

    private function user(Request $request): PlatformUser
    {
        $user = $request->user();
        assert($user instanceof PlatformUser);

        return $user;
    }

    private function token(Request $request): AccessToken
    {
        $token = $this->user($request)->currentAccessToken();
        assert($token instanceof AccessToken);

        return $token;
    }
}
