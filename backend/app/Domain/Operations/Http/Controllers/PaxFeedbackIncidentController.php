<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\IncidentWorkflow;
use App\Domain\Operations\Support\IncidentDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PaxFeedbackIncidentController
{
    public function store(Request $request, string $code, IncidentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'type' => ['required', Rule::in(IncidentDirectory::TYPES)],
            'severity' => ['required', Rule::in(IncidentDirectory::SEVERITIES)],
            'description' => ['required', 'string', 'min:5', 'max:4000'],
        ], [
            'title.*' => 'Escribe un título de al menos 5 caracteres.',
            'type.*' => 'Elige el tipo de incidencia.',
            'severity.*' => 'Elige la severidad.',
            'description.*' => 'Describe lo que pasó (mínimo 5 caracteres).',
        ]);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $workflow->fromFeedback($code, $data, $user)], 201);
    }
}
