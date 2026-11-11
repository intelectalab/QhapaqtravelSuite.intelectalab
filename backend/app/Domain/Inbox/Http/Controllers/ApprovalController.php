<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ApprovalWorkflow;
use App\Domain\Inbox\Actions\PortalRequestDecision;
use App\Domain\Inbox\Support\ApprovalInbox;
use App\Domain\Inbox\Support\ApprovalRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ApprovalController
{
    public function index(Request $request, ApprovalInbox $inbox): JsonResponse
    {
        return response()->json(['data' => $inbox->overview($this->user($request))]);
    }

    public function store(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        $code = $workflow->create($this->requestData($request, true), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $workflow->update($code, $this->requestData($request, false), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function withdraw(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);
        $workflow->withdraw($code, $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function approve(Request $request, string $code, ApprovalWorkflow $workflow, PortalRequestDecision $portal): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);
        $note = trim((string) ($data['note'] ?? '')) ?: null;

        return response()->json(['data' => $portal->decide($code, true, $note, $this->user($request)) ?? ['code' => $code, 'status' => $workflow->decide($code, true, $note, $this->user($request))]]);
    }

    public function reject(Request $request, string $code, ApprovalWorkflow $workflow, PortalRequestDecision $portal): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué se rechaza (APR-BR-07).']);

        return response()->json(['data' => $portal->decide($code, false, $data['note'], $this->user($request)) ?? ['code' => $code, 'status' => $workflow->decide($code, false, $data['note'], $this->user($request))]]);
    }

    public function delegate(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'uuid'],
            'note' => ['nullable', 'string', 'max:500'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['user_id.*' => 'Elige en quién delegas.']);
        $workflow->delegate($code, $data['user_id'], trim((string) ($data['note'] ?? '')) ?: null, $this->version($request, $data), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function askInfo(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'min:5', 'max:1000'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['question.*' => 'Escribe la pregunta (mínimo 5 caracteres).']);
        $workflow->askInfo($code, trim($data['question']), $this->version($request, $data), $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'info']], 201);
    }

    public function answerInfo(Request $request, string $code, string $info, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['answer' => ['required', 'string', 'min:2', 'max:2000']], ['answer.*' => 'Escribe la respuesta.']);
        $workflow->answerInfo($code, $info, trim($data['answer']), $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'pendiente']]);
    }

    public function resubmit(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:500']], ['note.*' => 'Cuenta qué corregiste (mínimo 5 caracteres).']);

        return response()->json(['data' => ['code' => $workflow->resubmit($code, trim($data['note']), $this->user($request)), 'from' => $code]], 201);
    }

    public function storeRule(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', ApprovalRules::RULE_TYPES)],
            'permission' => ['required', 'in:'.implode(',', array_keys(ApprovalRules::PERMISSION_LABELS))],
            ...$this->ruleRules(),
        ], ['type.*' => 'Elige el tipo de solicitud.', ...$this->ruleMessages()]);

        return response()->json(['data' => ['code' => $workflow->createRule($data, $this->user($request))]], 201);
    }

    public function updateRule(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'permission' => ['nullable', 'in:'.implode(',', array_keys(ApprovalRules::PERMISSION_LABELS))],
            ...$this->ruleRules(),
        ], $this->ruleMessages());
        $workflow->updateRule($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroyRule(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $workflow->deleteRule($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resetRules(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['rules' => $workflow->resetRules($this->user($request))]]);
    }

    private function ruleRules(): array
    {
        return [
            'min_amount' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'sla_hours' => ['required', 'integer', 'between:1,720'],
            'active' => ['required', 'boolean'],
            'forbid_self' => ['required', 'boolean'],
        ];
    }

    private function ruleMessages(): array
    {
        return [
            'permission.*' => 'Elige un permiso válido.',
            'min_amount.*' => 'El monto desde debe ser cero o mayor.',
            'sla_hours.*' => 'El plazo va de 1 a 720 horas.',
        ];
    }

    private function requestData(Request $request, bool $creating): array
    {
        return $request->validate([
            'type' => [$creating ? 'required' : 'nullable', 'in:'.implode(',', ApprovalInbox::GENERIC)],
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'amount' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'currency' => ['required', 'in:PEN,USD'],
            'agency' => [$request->input('type') === 'credit_b2b' && $creating ? 'required' : 'nullable', 'string', 'max:30'],
            'reservation' => ['nullable', 'string', 'max:30'],
            'justification' => ['required', 'string', 'min:10', 'max:2000'],
        ], [
            'type.*' => 'Elige el tipo de solicitud.',
            'title.*' => 'Escribe un título de al menos 5 caracteres.',
            'amount.*' => 'Indica el monto o impacto.',
            'currency.*' => 'Elige la moneda.',
            'agency.*' => 'Elige la agencia B2B: el crédito se evalúa sobre su línea.',
            'reservation.*' => 'Elige una reserva válida.',
            'justification.*' => 'Cuenta por qué se necesita (mínimo 10 caracteres).',
        ]);
    }

    private function version(Request $request, array $data): ?int
    {
        $header = $request->header('If-Match');

        if (is_string($header) && ctype_digit(trim($header, '" '))) {
            return (int) trim($header, '" ');
        }

        return isset($data['lock_version']) ? (int) $data['lock_version'] : null;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
