<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ConversationAttachments;
use App\Domain\Inbox\Actions\ConversationWorkflow;
use App\Domain\Inbox\Support\ConversationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function audit(Request $request, string $code, ConversationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->audit($code, $this->user($request))]);
    }

    public function download(Request $request, string $code, string $attachment, ConversationDirectory $directory): StreamedResponse
    {
        return $directory->download($code, $attachment, $this->user($request), $request->boolean('inline'));
    }

    public function reply(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required_without:attachments', 'nullable', 'string', 'min:2', 'max:4000'],
            'template' => ['nullable', 'string', 'max:30'],
            'internal' => ['nullable', 'boolean'],
            'resolve' => ['nullable', 'boolean'],
            'attachments' => ['nullable', 'array', 'max:'.ConversationAttachments::MAX_FILES],
            'attachments.*' => ['required', 'uuid'],
        ], ['body.*' => 'Escribe el mensaje o adjunta un archivo.', 'attachments.max' => 'Puedes adjuntar hasta '.ConversationAttachments::MAX_FILES.' archivos por mensaje.', 'attachments.*' => 'Un adjunto no es válido. Vuelve a adjuntarlo.']);
        $workflow->reply($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function attachment(Request $request, ConversationAttachments $attachments): JsonResponse
    {
        if ($request->hasFile('file')) {
            $file = $request->validate(['file' => ['required', 'file', 'max:'.(ConversationAttachments::MAX_BYTES / 1024)]], ['file.*' => 'Cada adjunto puede pesar hasta 16 MB.'])['file'];

            return response()->json(['data' => $attachments->upload($file, $this->user($request))], 201);
        }

        $data = $request->validate([
            'file_name' => ['required', 'string', 'max:200'],
            'mime' => ['required', 'string', 'max:100'],
            'size' => ['required', 'integer', 'min:1'],
            'sha256' => ['required', 'string', 'size:64'],
        ], ['file_name.*' => 'Elige el archivo que quieres adjuntar.', 'mime.*' => 'Indica el tipo del archivo.', 'size.*' => 'Indica el tamaño del archivo.', 'sha256.*' => 'Falta la huella del archivo.']);

        return response()->json(['data' => $attachments->presign($data, $this->user($request))]);
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

    public function linkOptions(Request $request, string $code, ConversationDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', array_keys(ConversationDirectory::LINKS))],
            'q' => ['nullable', 'string', 'max:80'],
        ], ['kind.*' => 'Elige qué vas a vincular.']);

        return response()->json(['data' => $directory->linkOptions($code, $data['kind'], (string) ($data['q'] ?? ''), $this->user($request))]);
    }

    public function link(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', array_keys(ConversationDirectory::LINKS))],
            'code' => ['required', 'string', 'max:40'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['kind.*' => 'Elige qué vas a vincular.', 'code.*' => 'Elige el registro.']);
        $workflow->link($code, $data['kind'], $data['code'], $this->version($request, $data), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function unlink(Request $request, string $code, ConversationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', array_keys(ConversationDirectory::LINKS))],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], ['kind.*' => 'Elige qué vínculo quitar.']);
        $workflow->unlink($code, $data['kind'], $this->version($request, $data), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function version(Request $request, array $data): ?int
    {
        $header = trim((string) $request->header('If-Match'), '" ');

        return ctype_digit($header) ? (int) $header : (isset($data['lock_version']) ? (int) $data['lock_version'] : null);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
