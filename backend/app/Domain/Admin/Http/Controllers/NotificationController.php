<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageNotifications;
use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Admin\Support\NotificationDirectory;
use App\Domain\Admin\Support\NotificationTemplates;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

final class NotificationController
{
    public function __construct(private readonly NotificationDirectory $directory, private readonly ManageNotifications $notifications) {}

    public function rules(Request $request): JsonResponse
    {
        return response()->json($this->directory->rulesPage($request, $this->user($request)));
    }

    public function rule(Request $request, string $event): JsonResponse
    {
        $this->directory->rule($event);
        $data = $request->validate([
            'ch_email' => ['sometimes', 'boolean'],
            'ch_whatsapp' => ['sometimes', 'boolean'],
            'ch_push' => ['sometimes', 'boolean'],
            'ch_portal' => ['sometimes', 'boolean'],
            'recipients' => ['sometimes', 'required', 'string', 'min:3', 'max:200'],
            'timing' => ['sometimes', 'required', 'in:'.implode(',', array_keys(NotificationCatalog::TIMINGS))],
            'condition' => ['sometimes', 'required', 'in:'.implode(',', array_keys(NotificationCatalog::CONDITIONS))],
        ], [
            'ch_*.boolean' => 'Indica si el canal está activo.',
            'recipients.*' => 'Indica quién recibe el aviso.',
            'timing.*' => 'Elige cuándo se envía.',
            'condition.*' => 'Elige la condición.',
        ]);
        $this->notifications->rule($event, $data, $this->user($request));

        return response()->json(['data' => $this->directory->rule($event)]);
    }

    public function testRule(Request $request, string $event): JsonResponse
    {
        $codes = $this->notifications->testRule($event, $this->directory->rule($event), $this->user($request));

        return response()->json(['data' => $this->directory->rule($event), 'meta' => ['sent' => $codes]]);
    }

    public function template(string $event, string $channel, NotificationTemplates $templates): JsonResponse
    {
        return response()->json(['data' => $templates->current($event, $channel)]);
    }

    public function saveTemplate(Request $request, string $event, string $channel, NotificationTemplates $templates): JsonResponse
    {
        $templates->assertTarget($event, $channel);
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'provider_template_id' => ['nullable', 'string', 'max:120'],
        ], [
            'subject.*' => 'Escribe el asunto o título.',
            'body.*' => 'Escribe el mensaje.',
        ]);
        $this->notifications->saveTemplate($event, $channel, $data, $this->user($request));

        return response()->json(['data' => $templates->current($event, $channel)]);
    }

    public function restoreTemplate(string $event, string $channel): Response
    {
        $this->notifications->restoreTemplate($event, $channel);

        return response()->noContent();
    }

    public function testTemplate(Request $request, string $event, string $channel, NotificationTemplates $templates): JsonResponse
    {
        $templates->assertTarget($event, $channel);
        $data = $request->validate(['subject' => ['nullable', 'string', 'max:200'], 'body' => ['nullable', 'string', 'max:5000']]);
        $message = $this->notifications->testTemplate($event, $channel, $data, $this->user($request));

        return response()->json(['data' => ['message' => NotificationDirectory::map((object) [...(array) $message, 'user_name' => $this->user($request)->name]), 'template' => $templates->current($event, $channel)]]);
    }

    public function messages(Request $request): JsonResponse
    {
        return response()->json($this->directory->messagesPage($request));
    }

    public function retry(string $id): JsonResponse
    {
        return response()->json(['data' => $this->directory->message($this->notifications->retry($id))]);
    }

    public function fallback(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->directory->message($this->notifications->fallback($id, $this->user($request)))]);
    }

    public function retryFailed(): JsonResponse
    {
        $result = $this->notifications->retryFailed();

        return response()->json(['data' => ['id' => (string) Str::uuid7(), 'status' => 'en_cola', ...$result]], 202);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
