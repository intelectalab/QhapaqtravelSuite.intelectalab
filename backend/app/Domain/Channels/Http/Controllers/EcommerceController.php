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

    public function summary(Request $request, EcommerceDirectory $directory): JsonResponse
    {
        $overview = $directory->overview($this->user($request));

        return response()->json(['data' => ['kpis' => $overview['kpis'], 'funnel' => $overview['funnel']]]);
    }

    public function orders(Request $request, EcommerceDirectory $directory): JsonResponse
    {
        $status = $request->query('status');
        $orders = collect($directory->overview($this->user($request))['orders'])->when(is_string($status) && $status !== '', fn ($rows) => $rows->where('status', $status))->values();

        return response()->json(['data' => $orders]);
    }

    public function order(Request $request, string $code, EcommerceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->order($code, $this->user($request))]);
    }

    public function products(Request $request, EcommerceDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))['products']]);
    }

    public function paymentLink(Request $request, string $code, ManageEcommerce $manage): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']], ['note.*' => 'La nota admite hasta 300 caracteres.']);

        return response()->json(['data' => $manage->sendPaymentLink($code, $data['note'] ?? null, $this->user($request))]);
    }

    public function publish(Request $request, string $code, ManageEcommerce $manage): JsonResponse
    {
        $manage->publish($code, true, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function unpublish(Request $request, string $code, ManageEcommerce $manage): JsonResponse
    {
        $manage->publish($code, false, $this->user($request));

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
