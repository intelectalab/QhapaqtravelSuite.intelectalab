<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\Assistant\AssistantWorkflow;
use App\Domain\Growth\Shared\GrowthRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AssistantController
{
    public function __construct(private readonly AssistantWorkflow $workflow) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(AssistantWorkflow::KINDS))],
            'prompt' => ['required', 'string', 'min:8', 'max:4000'],
            'source_type' => ['nullable', Rule::in(array_keys(AssistantWorkflow::SOURCES)), 'required_with:source_code'],
            'source_code' => ['nullable', 'string', 'max:40', 'required_with:source_type'],
        ], [
            'kind.*' => 'Elige qué quieres que prepare el asistente.',
            'prompt.*' => 'Describe el pedido en 8 a 4000 caracteres.',
            'source_type.*' => 'Indica si el pedido viene de una cotización, un lead o una conversación.',
            'source_code.*' => 'Indica el código del registro de origen.',
        ]);

        return response()->json(['data' => $this->workflow->request($data, GrowthRules::actor($request))], 202);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->workflow->show($id, GrowthRules::actor($request))]);
    }

    public function apply(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->workflow->apply($id, GrowthRules::actor($request))]);
    }

    public function discard(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->workflow->discard($id, GrowthRules::actor($request))]);
    }

    public function usage(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->workflow->usage(GrowthRules::actor($request))]);
    }
}
