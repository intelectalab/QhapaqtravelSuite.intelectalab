<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\EvidenceWorkflow;
use App\Domain\Operations\Support\EvidenceStore;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class EvidenceController
{
    private const UPLOAD_MESSAGES = [
        'file.required' => 'Elige el archivo de la evidencia.',
        'file.file' => 'Elige el archivo de la evidencia.',
        'file.uploaded' => 'No pudimos recibir el archivo. Revisa que pese como máximo 10 MB.',
        'file.max' => 'La evidencia debe pesar como máximo 10 MB.',
        'file.mimetypes' => 'La evidencia debe ser una imagen (JPG, PNG, WEBP o HEIC) o un PDF.',
        'reservation_service_id.*' => 'Elige un servicio de la orden.',
    ];

    public function __construct(private readonly EvidenceWorkflow $workflow, private readonly EvidenceStore $store) {}

    public function index(string $code): JsonResponse
    {
        $order = DB::table('ops_orders')->whereNull('deleted_at')->where('code', $code)->value('id') ?? throw ApiException::notFound('La orden operativa no existe.');

        return response()->json(['data' => $this->store->forOrder((string) $order)]);
    }

    public function presign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file_name' => ['required', 'string', 'max:200'],
            'mime' => ['required', 'string', 'max:80'],
            'size' => ['required', 'integer', 'min:1'],
            'sha256' => ['required', 'string', 'regex:/^[a-fA-F0-9]{64}$/'],
        ], [
            'file_name.*' => 'Indica el nombre del archivo.',
            'mime.*' => 'Indica el tipo del archivo.',
            'size.*' => 'Indica el tamaño del archivo en bytes.',
            'sha256.*' => 'Indica la huella SHA-256 del archivo.',
        ]);

        return response()->json(['data' => $this->workflow->presign($data, $this->user($request))]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $data = $this->uploads($request, withService: true);

        return response()->json(['data' => $this->workflow->registerForOrder($code, $data['reservation_service_id'] ?? null, $data['uploads'], $data['source'] ?? 'web', $this->user($request))], 201);
    }

    public function upload(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([...$this->fileRules(), 'reservation_service_id' => ['nullable', 'string', 'max:40']], self::UPLOAD_MESSAGES);

        return response()->json(['data' => $this->workflow->uploadForOrder($code, $this->uploaded($request), $data['reservation_service_id'] ?? null, $this->user($request))], 201);
    }

    public function storeForIncident(Request $request, string $code): JsonResponse
    {
        $data = $this->uploads($request, withService: false);

        return response()->json(['data' => $this->workflow->registerForIncident($code, $data['uploads'], $data['source'] ?? 'web', $this->user($request))], 201);
    }

    public function uploadForIncident(Request $request, string $code): JsonResponse
    {
        $request->validate($this->fileRules(), self::UPLOAD_MESSAGES);

        return response()->json(['data' => $this->workflow->uploadForIncident($code, $this->uploaded($request), $this->user($request))], 201);
    }

    public function destroy(Request $request, string $evidence): Response
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica por qué se retira la evidencia (mínimo 5 caracteres).']);
        $this->workflow->remove($evidence, $data['reason'], $this->user($request));

        return response()->noContent();
    }

    public function file(string $evidence): StreamedResponse
    {
        return $this->workflow->file($evidence);
    }

    private function uploads(Request $request, bool $withService): array
    {
        return $request->validate([
            ...($withService ? ['reservation_service_id' => ['nullable', 'string', 'max:40']] : []),
            'source' => ['nullable', 'in:web,app_operador,extranet'],
            'uploads' => ['required', 'array', 'min:1', 'max:20'],
            'uploads.*.upload_id' => ['required', 'uuid'],
            'uploads.*.sha256' => ['nullable', 'string', 'regex:/^[a-fA-F0-9]{64}$/'],
        ], [
            'reservation_service_id.*' => 'Elige un servicio de la orden.',
            'source.*' => 'El origen de la evidencia no es válido.',
            'uploads.*.upload_id.*' => 'Cada carga necesita el upload_id que devolvió la URL prefirmada.',
            'uploads.*.sha256.*' => 'La huella SHA-256 no es válida.',
            'uploads.required' => 'Indica al menos una carga.',
            'uploads.array' => 'Indica al menos una carga.',
            'uploads.min' => 'Indica al menos una carga.',
            'uploads.max' => 'Registra hasta 20 cargas por vez.',
        ]);
    }

    private function fileRules(): array
    {
        return ['file' => ['required', 'file', 'max:'.intdiv(EvidenceStore::MAX_BYTES, 1024), 'mimetypes:'.implode(',', array_keys(EvidenceStore::MIME))]];
    }

    private function uploaded(Request $request): UploadedFile
    {
        $file = $request->file('file');
        assert($file instanceof UploadedFile);

        return $file;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
