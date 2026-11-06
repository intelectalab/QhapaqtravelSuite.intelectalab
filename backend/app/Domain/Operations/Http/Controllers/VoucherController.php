<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\VoucherWorkflow;
use App\Domain\Operations\Support\VoucherDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class VoucherController
{
    public function __construct(private readonly VoucherWorkflow $workflow) {}

    public function index(Request $request, VoucherDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_code' => ['required', 'string', 'max:30'],
            'provider_id' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string', 'max:500'],
        ], ['service_code.*' => 'Elige el servicio confirmado.', 'provider_id.*' => 'Elige el proveedor.', 'note.*' => 'La nota admite hasta 500 caracteres.']);
        $code = $this->workflow->issue($data['service_code'], $data['provider_id'] ?? null, $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function version(Request $request, string $code): JsonResponse
    {
        $this->workflow->newVersion($code, $this->reason($request, 'Explica qué cambia en esta versión.'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function redeem(Request $request, string $code): JsonResponse
    {
        $this->workflow->redeem($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function void(Request $request, string $code): JsonResponse
    {
        $this->workflow->void($code, $this->reason($request, 'Explica por qué se anula (mínimo 5 caracteres).'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function reason(Request $request, string $message): string
    {
        return $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => $message])['reason'];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
