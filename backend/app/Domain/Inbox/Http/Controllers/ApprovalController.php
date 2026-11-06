<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ApprovalWorkflow;
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

    public function approve(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        return response()->json(['data' => ['code' => $code, 'status' => $workflow->decide($code, true, $data['note'] ?? null, $this->user($request))]]);
    }

    public function reject(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué se rechaza (APR-BR-07).']);

        return response()->json(['data' => ['code' => $code, 'status' => $workflow->decide($code, false, $data['note'], $this->user($request))]]);
    }

    public function updateRule(Request $request, string $code, ApprovalWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'permission' => ['nullable', 'in:'.implode(',', array_keys(ApprovalRules::PERMISSION_LABELS))],
            'min_amount' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'sla_hours' => ['required', 'integer', 'between:1,720'],
            'active' => ['required', 'boolean'],
            'forbid_self' => ['required', 'boolean'],
        ], [
            'permission.*' => 'Elige un permiso válido.',
            'min_amount.*' => 'El monto desde debe ser cero o mayor.',
            'sla_hours.*' => 'El plazo va de 1 a 720 horas.',
        ]);
        $workflow->updateRule($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function requestData(Request $request, bool $creating): array
    {
        return $request->validate([
            'type' => [$creating ? 'required' : 'nullable', 'in:'.implode(',', ApprovalInbox::GENERIC)],
            'title' => ['required', 'string', 'min:5', 'max:200'],
            'amount' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'currency' => ['required', 'in:PEN,USD'],
            'reference' => ['nullable', 'string', 'max:40'],
            'justification' => ['required', 'string', 'min:10', 'max:2000'],
        ], [
            'type.*' => 'Elige el tipo de solicitud.',
            'title.*' => 'Escribe un título de al menos 5 caracteres.',
            'amount.*' => 'Indica el monto o impacto.',
            'currency.*' => 'Elige la moneda.',
            'justification.*' => 'Cuenta por qué se necesita (mínimo 10 caracteres).',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
