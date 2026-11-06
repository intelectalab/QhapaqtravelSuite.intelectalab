<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\AfterSalesWorkflow;
use App\Domain\Crm\Support\AfterSalesDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AfterSalesController
{
    public function index(Request $request, AfterSalesDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function storeSurvey(Request $request, AfterSalesWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'client' => ['required', 'string', 'max:30'],
            'reservation' => ['nullable', 'string', 'max:30'],
            ...$this->surveyRules(),
        ], ['client.*' => 'Elige el cliente.', ...$this->surveyMessages()]);

        return response()->json(['data' => ['code' => $workflow->recordSurvey($data, $this->user($request))]], 201);
    }

    public function updateSurvey(Request $request, string $code, AfterSalesWorkflow $workflow): JsonResponse
    {
        $workflow->updateSurvey($code, $request->validate($this->surveyRules(), $this->surveyMessages()), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function storeCase(Request $request, AfterSalesWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'client' => ['required', 'string', 'max:30'],
            'reservation' => ['nullable', 'string', 'max:30'],
            ...$this->caseRules(),
        ], ['client.*' => 'Elige el cliente.', ...$this->caseMessages()]);

        return response()->json(['data' => ['code' => $workflow->createCase($data, $this->user($request))]], 201);
    }

    public function updateCase(Request $request, string $code, AfterSalesWorkflow $workflow): JsonResponse
    {
        $workflow->updateCase($code, $request->validate($this->caseRules(), $this->caseMessages()), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function transitionCase(Request $request, string $code, AfterSalesWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'step' => ['required', 'in:start,followup,resolve,close,reopen'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], ['step.*' => 'Elige qué paso registrar.']);
        $workflow->transition($code, $data['step'], $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function surveyRules(): array
    {
        return [
            'score' => ['required', 'integer', 'between:0,10'],
            'channel' => ['required', Rule::exists('crm_catalog_items', 'code')->where('kind', 'survey_channel')],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function surveyMessages(): array
    {
        return ['score.*' => 'El puntaje va de 0 a 10.', 'channel.*' => 'Elige el canal de la encuesta.', 'comment.*' => 'El comentario es demasiado largo.'];
    }

    private function caseRules(): array
    {
        return [
            'type' => ['required', Rule::exists('crm_catalog_items', 'code')->where('kind', 'case_type')],
            'priority' => ['required', 'in:baja,media,alta,critica'],
            'subject' => ['required', 'string', 'min:4', 'max:200'],
            'description' => ['required', 'string', 'min:5', 'max:4000'],
            'owner_id' => ['nullable', 'uuid', Rule::exists('iam_users', 'id')],
        ];
    }

    private function caseMessages(): array
    {
        return [
            'type.*' => 'Elige el tipo de caso.',
            'priority.*' => 'Elige la prioridad.',
            'subject.*' => 'Escribe un asunto (mínimo 4 caracteres).',
            'description.*' => 'Describe el caso.',
            'owner_id.*' => 'Elige un responsable válido.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
