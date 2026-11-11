<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManagePaxMessages;
use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaxMessageController
{
    public function store(Request $request, string $code, ManagePaxMessages $messages): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:'.implode(',', array_keys(PaxTemplateDirectory::CHANNELS))],
            'template' => ['nullable', 'string', 'max:20'],
            'subject' => ['nullable', 'string', 'max:200'],
            'body' => ['required_without:template', 'nullable', 'string', 'min:10', 'max:4000'],
            'scheduled_at' => ['nullable', 'date'],
        ], [
            'channel.*' => 'Elige el canal.',
            'subject.*' => 'El asunto admite hasta 200 caracteres.',
            'body.*' => 'Escribe el mensaje (mínimo 10 caracteres) o elige una plantilla.',
            'scheduled_at.*' => 'La fecha de envío debe ser futura.',
        ]);

        return response()->json(['data' => ['code' => $messages->manual($code, array_filter($data, fn ($value): bool => $value !== null), $this->user($request))]], 201);
    }

    public function sendNow(Request $request, string $code, ManagePaxMessages $messages): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'status' => $messages->sendNow($code, $this->user($request))]]);
    }

    public function cancel(Request $request, string $code, ManagePaxMessages $messages): JsonResponse
    {
        $messages->cancel($code, $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'cancelado']]);
    }

    public function retry(Request $request, string $code, ManagePaxMessages $messages): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'status' => $messages->retry($code, $this->user($request))]]);
    }

    public function reschedule(Request $request, ManagePaxMessages $messages): JsonResponse
    {
        return response()->json(['data' => $messages->reschedule($this->user($request))]);
    }

    public function test(Request $request, string $code, ManagePaxMessages $messages): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'status' => $messages->test($code, $this->user($request))]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
