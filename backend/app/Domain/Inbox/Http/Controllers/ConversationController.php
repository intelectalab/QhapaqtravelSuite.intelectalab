<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ConversationWorkflow;
use App\Domain\Inbox\Support\ConversationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ConversationController
{
    public function index(Request $request, ConversationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function show(Request $request, string $code, ConversationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->thread($code, $this->user($request))]);
    }

    public function reply(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:4000'],
            'template' => ['nullable', 'string', 'max:30'],
            'internal' => ['nullable', 'boolean'],
            'resolve' => ['nullable', 'boolean'],
        ], ['body.*' => 'Escribe el mensaje.']);
        $workflow->reply($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function assign(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['assignee_id' => ['nullable', 'uuid']], ['assignee_id.*' => 'Elige a quién asignarla.']);
        $workflow->assign($code, $data['assignee_id'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resolve(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $workflow->status($code, 'resuelta', $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reopen(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $workflow->status($code, 'abierta', $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function update(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'priority' => ['required', 'in:'.implode(',', array_keys(ConversationDirectory::PRIORITIES))],
            'tags' => ['nullable', 'array', 'max:8'],
            'tags.*' => ['string', 'max:30'],
        ], ['priority.*' => 'Elige la prioridad.', 'tags.*' => 'Revisa las etiquetas (máximo 8).']);
        $workflow->classify($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
