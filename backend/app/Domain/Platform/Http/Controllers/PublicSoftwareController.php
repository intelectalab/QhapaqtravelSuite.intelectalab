<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\RegisterDemoRequest;
use App\Domain\Platform\Http\Requests\DemoRequestStoreRequest;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use App\Domain\Platform\Support\PublicPlans;
use App\Domain\Platform\Support\PublicShowcase;
use Illuminate\Http\JsonResponse;

final class PublicSoftwareController
{
    public function plans(PublicPlans $plans): JsonResponse
    {
        return response()->json(['data' => $plans->catalog()]);
    }

    public function overview(PublicShowcase $showcase): JsonResponse
    {
        return response()->json(['data' => $showcase->overview()]);
    }

    public function demoOptions(PublicPlans $plans): JsonResponse
    {
        return response()->json(['data' => [
            'business_types' => TenantProvisionRequest::BUSINESS_TYPES,
            'team_sizes' => DemoRequestStoreRequest::TEAM_SIZES,
            'plans' => collect($plans->catalog()['plans'])->map(fn (array $plan) => ['code' => $plan['code'], 'name' => $plan['name'], 'trial_days' => $plan['trial_days']])->values(),
        ]]);
    }

    public function requestDemo(DemoRequestStoreRequest $request, RegisterDemoRequest $register): JsonResponse
    {
        $result = $register($request->validated());

        return response()->json(['data' => [
            ...$result,
            'message' => $result['repeated'] ? 'Ya teníamos tu solicitud. Te escribiremos muy pronto.' : 'Recibimos tu solicitud. Te escribiremos en menos de un día hábil.',
        ]], $result['repeated'] ? 200 : 201);
    }
}
