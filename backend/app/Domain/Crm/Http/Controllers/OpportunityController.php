<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\OpportunityWorkflow;
use App\Domain\Crm\Support\OpportunityDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OpportunityController
{
    public function __construct(private readonly OpportunityDirectory $directory)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->board($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La oportunidad no existe.')]);
    }

    public function stage(Request $request, string $code, OpportunityWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'stage' => ['required', 'in:calificacion,descubrimiento,cotizacion,negociacion,ganada,perdida'],
            'lost_reason' => ['nullable', 'string'],
            'lost_detail' => ['nullable', 'string', 'max:1000'],
            'confirm_reopen' => ['boolean'],
        ]);
        $warnings = $workflow->changeStage($code, $data, $this->user($request));

        return response()->json(['data' => $this->directory->find($this->user($request), $code), 'meta' => ['warnings' => $warnings]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
