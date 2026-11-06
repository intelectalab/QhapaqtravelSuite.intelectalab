<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\IncidentWorkflow;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class IncidentController
{
    public function __construct(private readonly IncidentWorkflow $workflow) {}

    public function index(Request $request, IncidentDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code, IncidentDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($this->user($request), $code) ?? throw ApiException::notFound('La incidencia no existe.')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_code' => ['required', 'string', 'max:30'],
            ...$this->rules(),
        ], ['order_code.*' => 'Elige la orden operativa afectada.', ...$this->messages()]);
        $code = $this->workflow->create($data, $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $this->workflow->update($code, $request->validate($this->rules(), $this->messages()), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function take(Request $request, string $code): JsonResponse
    {
        $this->workflow->take($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resolve(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['resolution' => ['required', 'string', 'min:5', 'max:2000']], ['resolution.*' => 'Describe cómo se resolvió (mínimo 5 caracteres).']);
        $this->workflow->resolve($code, $data['resolution'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function close(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['comment' => ['nullable', 'string', 'max:1000']], ['comment.*' => 'El comentario admite hasta 1000 caracteres.']);
        $this->workflow->close($code, $data['comment'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reopen(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica por qué se reabre (mínimo 5 caracteres).']);
        $this->workflow->reopen($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function comment(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'min:2', 'max:1000']], ['message.*' => 'Escribe el comentario.']);
        $this->workflow->comment($code, $data['message'], $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    private function rules(): array
    {
        return [
            'type' => ['required', 'in:'.implode(',', IncidentDirectory::TYPES)],
            'severity' => ['required', 'in:'.implode(',', IncidentDirectory::SEVERITIES)],
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'description' => ['required', 'string', 'min:5', 'max:4000'],
            'assignee_id' => ['nullable', 'uuid'],
        ];
    }

    private function messages(): array
    {
        return [
            'type.*' => 'Elige el tipo de incidencia.',
            'severity.*' => 'Elige la severidad.',
            'title.*' => 'Escribe un título (mínimo 5 caracteres).',
            'description.*' => 'Describe lo ocurrido (mínimo 5 caracteres).',
            'assignee_id.*' => 'Elige un responsable de la lista.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
