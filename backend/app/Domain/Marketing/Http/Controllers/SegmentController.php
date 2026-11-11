<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\SegmentWorkflow;
use App\Domain\Marketing\Support\CampaignDirectory;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SegmentController
{
    public function index(CampaignDirectory $directory, ContactBook $contacts): JsonResponse
    {
        return response()->json(['data' => $directory->segments(), 'meta' => ['fields' => $contacts->catalog()]]);
    }

    public function show(string $code, CampaignDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->segment($code)]);
    }

    public function store(Request $request, SegmentWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $workflow->create($this->validated($request), $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, SegmentWorkflow $workflow): JsonResponse
    {
        $workflow->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function duplicate(Request $request, string $code, SegmentWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $workflow->duplicate($code, $this->user($request))]], 201);
    }

    public function destroy(Request $request, string $code, SegmentWorkflow $workflow): JsonResponse
    {
        $workflow->delete($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function preview(Request $request, ContactBook $contacts): JsonResponse
    {
        $data = $request->validate(['match' => ['required', 'in:all,any'], 'rules' => ['present', 'array', 'max:12']], ['match.*' => 'Elige si deben cumplirse todas las reglas o alguna.', 'rules.*' => 'Las reglas no son válidas.']);
        $rules = $data['rules'];
        $error = $contacts->rulesError($rules);

        if ($error !== null) {
            throw ApiException::unprocessable('MKT-BR-13', $error);
        }

        return response()->json(['data' => $contacts->preview($data['match'], $contacts->normalize($rules))]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:4', 'max:160'],
            'description' => ['nullable', 'string', 'max:500'],
            'match' => ['required', 'in:all,any'],
            'rules' => ['present', 'array', 'max:12'],
        ], [
            'name.*' => 'Escribe un nombre de 4 a 160 caracteres.',
            'description.*' => 'La descripción admite hasta 500 caracteres.',
            'match.*' => 'Elige si deben cumplirse todas las reglas o alguna.',
            'rules.*' => 'Agrega hasta 12 reglas.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
