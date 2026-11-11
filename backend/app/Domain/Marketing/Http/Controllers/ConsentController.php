<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\ConsentWorkflow;
use App\Domain\Marketing\Support\ConsentDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ConsentController
{
    public function contacts(Request $request, ConsentDirectory $directory): JsonResponse
    {
        $filters = $request->validate([
            'filter.type' => ['nullable', 'in:client,lead,subscriber'],
            'filter.consent' => ['nullable', 'in:email,whatsapp'],
        ]);

        return response()->json(['data' => $directory->contacts($this->user($request), $filters['filter']['type'] ?? null, $filters['filter']['consent'] ?? null)]);
    }

    public function index(Request $request, ConsentDirectory $directory): JsonResponse
    {
        $filters = $request->validate([
            'filter.channel' => ['nullable', 'in:email,whatsapp'],
            'filter.status' => ['nullable', 'in:otorgado,revocado'],
        ]);

        return response()->json(['data' => $directory->records($filters['filter']['channel'] ?? null, $filters['filter']['status'] ?? null)->values()]);
    }

    public function events(string $code, ConsentDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->history($code)->values()]);
    }

    public function store(Request $request, ConsentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', 'in:client,lead,subscriber'],
            'subject_id' => ['required', 'uuid'],
            'channel' => ['required', 'in:email,whatsapp'],
            'source' => ['required', Rule::in(ConsentDirectory::GRANT_SOURCES)],
            'evidence' => ['required', 'string', 'min:4', 'max:500'],
            'policy_version' => ['required', 'string', 'max:20'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], [
            'subject_type.*' => 'Elige el contacto.',
            'subject_id.*' => 'Elige el contacto.',
            'channel.*' => 'Elige el canal.',
            'source.*' => 'Elige el origen del consentimiento (MKT-BR-11).',
            'evidence.*' => 'Describe la evidencia: IP, ID de formulario, grabación o ficha (MKT-BR-11).',
            'policy_version.*' => 'Indica la versión de la política informada.',
        ]);

        return response()->json(['data' => ['code' => $workflow->grant($data, $this->user($request))]], 201);
    }

    public function revoke(Request $request, string $code, ConsentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', Rule::in(ConsentDirectory::REVOKE_SOURCES)],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], [
            'source.*' => 'Elige el origen de la baja.',
        ]);
        $workflow->revoke($code, $data['source'], isset($data['lock_version']) ? (int) $data['lock_version'] : null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
