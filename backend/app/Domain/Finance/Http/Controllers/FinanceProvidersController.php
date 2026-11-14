<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\AgencyOse;
use App\Domain\Finance\Actions\FxProviders;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FinanceProvidersController
{
    public function selectFx(Request $request, FxProviders $providers): JsonResponse
    {
        $data = $request->validate(['code' => ['present', 'nullable', 'string', 'max:20']], ['code.*' => 'Elige un proveedor o «Solo carga manual».']);
        $list = $providers->select($data['code'] ?? null, $this->user($request));

        return response()->json(['data' => $list['providers'], 'meta' => array_diff_key($list, ['providers' => true])]);
    }

    public function ose(Request $request, AgencyOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->overview($this->user($request))]);
    }

    public function selectOse(Request $request, AgencyOse $ose): JsonResponse
    {
        $data = $request->validate(['code' => ['present', 'nullable', 'string', 'max:20']], ['code.*' => 'Elige un OSE homologado.']);

        return response()->json(['data' => $ose->select($data['code'] ?? null, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
