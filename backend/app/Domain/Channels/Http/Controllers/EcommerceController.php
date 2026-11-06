<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ManageEcommerce;
use App\Domain\Channels\Support\EcommerceDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EcommerceController
{
    public function index(Request $request, EcommerceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function publish(Request $request, string $code, ManageEcommerce $manage): JsonResponse
    {
        $data = $request->validate(['published' => ['required', 'boolean']], ['published.*' => 'Indica si se publica o no.']);
        $manage->publish($code, (bool) $data['published'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function cancel(Request $request, string $code, ManageEcommerce $manage): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:200']], ['reason.*' => 'Indica el motivo de la anulación.']);
        $manage->cancel($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
