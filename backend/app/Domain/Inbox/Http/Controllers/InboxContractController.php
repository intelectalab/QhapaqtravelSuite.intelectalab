<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ConversationWorkflow;
use App\Domain\Inbox\Actions\ReplyTemplates;
use App\Domain\Inbox\Support\ApprovalInbox;
use App\Domain\Inbox\Support\ApprovalRules;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class InboxContractController
{
    public function rules(Request $request, ApprovalRules $rules): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $items = $rules->list()
            ->when(isset($filters['type']), fn ($list) => $list->where('type', $filters['type']))
            ->when(isset($filters['active']), fn ($list) => $list->where('active', filter_var($filters['active'], FILTER_VALIDATE_BOOLEAN)))
            ->values();

        return response()->json(CursorPage::respondItems($request, $items->all(), ['permissions' => $rules->permissionOptions()]));
    }

    public function counters(Request $request, ApprovalInbox $inbox): JsonResponse
    {
        return response()->json(['data' => $inbox->counters($inbox->items($this->user($request)))]);
    }

    public function show(Request $request, string $code, ApprovalInbox $inbox): JsonResponse
    {
        $items = $inbox->items($this->user($request));
        $item = $items->firstWhere('key', "request:{$code}") ?? $items->firstWhere('code', $code) ?? throw ApiException::notFound('La solicitud no existe.');
        $snapshot = DB::table('collab_approval_requests')->where('code', $item['code'])->value('origin_snapshot');

        return response()->json(['data' => [...$item, 'origin_snapshot' => $snapshot === null ? null : json_decode((string) $snapshot, true)]]);
    }

    public function cancelPreview(Request $request, string $reservation, ReservationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['reservation' => $reservation, ...$workflow->cancellationPreview($reservation, $this->user($request))]]);
    }

    public function templates(Request $request, ReplyTemplates $templates): JsonResponse
    {
        $user = $this->user($request);

        return response()->json(['data' => $templates->list($user->can('admin.settings.manage')), 'meta' => ['channels' => ReplyTemplates::CHANNELS, 'can_manage' => $user->can('admin.settings.manage')]]);
    }

    public function storeTemplate(Request $request, ReplyTemplates $templates): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'body' => ['required', 'string', 'min:5', 'max:4000'],
            ...$this->templateRules(),
        ], $this->templateMessages());

        return response()->json(['data' => $templates->create($data, $this->user($request))], 201);
    }

    public function updateTemplate(Request $request, string $id, ReplyTemplates $templates): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'body' => ['sometimes', 'string', 'min:5', 'max:4000'],
            ...$this->templateRules(),
        ], $this->templateMessages());

        return response()->json(['data' => $templates->update($id, $data, $this->user($request))]);
    }

    public function note(Request $request, string $code, ConversationWorkflow $workflow, ConversationDirectory $directory): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:4000']], ['body.*' => 'Escribe la nota interna (de 2 a 4000 caracteres).']);
        $user = $this->user($request);
        $workflow->reply($code, ['body' => trim($data['body']), 'internal' => true], $user);

        return response()->json(['data' => $directory->thread($code, $user)], 201);
    }

    private function templateRules(): array
    {
        return [
            'channels' => ['sometimes', 'array', 'min:1'],
            'channels.*' => [Rule::in(array_keys(ReplyTemplates::CHANNELS))],
            'is_whatsapp_approved' => ['sometimes', 'boolean'],
            'whatsapp_template_name' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9_]+$/'],
            'whatsapp_language' => ['nullable', 'string', 'max:5', 'regex:/^[a-z]{2}(_[A-Z]{2})?$/'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    private function templateMessages(): array
    {
        return [
            'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
            'body.*' => 'Escribe el texto de la plantilla (de 5 a 4000 caracteres).',
            'channels.*' => 'Elige al menos un canal válido.',
            'channels.*.*' => 'Elige canales de la lista.',
            'whatsapp_template_name.*' => 'El nombre de la plantilla de WhatsApp va en minúsculas, números y guion bajo.',
            'whatsapp_language.*' => 'El idioma va como es o es_PE.',
            'is_whatsapp_approved.*' => 'Indica si la plantilla está aprobada por WhatsApp.',
            'is_active.*' => 'Indica si la plantilla queda activa.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
