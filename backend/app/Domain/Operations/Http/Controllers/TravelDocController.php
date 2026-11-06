<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\TravelDocWorkflow;
use App\Domain\Operations\Support\TravelDocDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TravelDocController
{
    public function __construct(private readonly TravelDocDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La reserva no tiene checklist documental.')]);
    }

    public function validateItem(Request $request, string $item, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'doc_number' => ['nullable', 'string', 'max:40'],
            'expiry_date' => ['nullable', 'date'],
        ], ['doc_number.*' => 'Revisa el número del documento.', 'expiry_date.*' => 'Revisa la fecha de vencimiento.']);
        $workflow->validate($item, $data, $this->user($request));

        return response()->json(['data' => ['id' => $item]]);
    }

    public function observe(Request $request, string $item, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica qué falta o qué debe corregirse (mínimo 5 caracteres).']);
        $workflow->observe($item, $data['reason'], $this->user($request));

        return response()->json(['data' => ['id' => $item]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
