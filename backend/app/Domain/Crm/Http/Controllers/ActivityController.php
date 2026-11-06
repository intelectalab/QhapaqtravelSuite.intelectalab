<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ActivityWorkflow;
use App\Domain\Crm\Support\ActivityDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ActivityController
{
    public const TYPES = 'in:llamada,email,whatsapp,reunion,tarea,postventa';

    public function __construct(private readonly ActivityDirectory $directory, private readonly ActivityWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->agenda($this->user($request))]);
    }

    public function options(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->relatedOptions($this->user($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', self::TYPES],
            'subject' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'related_type' => ['nullable', 'in:lead,opportunity,client'],
            'related_code' => ['required_with:related_type', 'nullable', 'string'],
            'due_at' => ['required', 'date'],
        ], [
            'subject.required' => 'Escribe el asunto.',
            'due_at.required' => 'Elige la fecha y la hora.',
            'related_code.required_with' => 'Elige el registro relacionado.',
        ]);

        return response()->json(['data' => ['code' => $this->workflow->create($data, $this->user($request))]], 201);
    }

    public function complete(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'result' => ['required', 'string', 'max:2000'],
            'next' => ['nullable', 'array'],
            'next.type' => ['required_with:next', self::TYPES],
            'next.subject' => ['required_with:next', 'string', 'max:200'],
            'next.due_at' => ['required_with:next', 'date'],
        ], [
            'result.required' => 'Cuenta cómo te fue.',
            'next.subject.required_with' => 'Escribe el asunto de la próxima actividad.',
            'next.due_at.required_with' => 'Elige cuándo será la próxima actividad.',
        ]);

        return response()->json(['data' => ['next' => $this->workflow->complete($code, $data, $this->user($request))]]);
    }

    public function reschedule(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['due_at' => ['required', 'date']], ['due_at.required' => 'Elige la nueva fecha y hora.']);
        $this->workflow->reschedule($code, $data['due_at'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', self::TYPES],
            'subject' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'owner_id' => ['nullable', 'uuid'],
        ], ['subject.required' => 'Escribe el asunto.']);
        $this->workflow->update($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);
        $this->workflow->delete($code, $request->input('reason'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
