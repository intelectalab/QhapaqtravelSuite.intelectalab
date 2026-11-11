<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\SaveTravelDocSettings;
use App\Domain\Operations\Actions\TravelDocWorkflow;
use App\Domain\Operations\Support\TravelDocDirectory;
use App\Domain\Operations\Support\TravelDocRules;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\RemindTravelDocuments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TravelDocController
{
    public function __construct(private readonly TravelDocDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La reserva no tiene checklist documental.')]);
    }

    public function passengers(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))['passengers']]);
    }

    public function rules(): JsonResponse
    {
        return response()->json(['data' => $this->directory->rules()]);
    }

    public function runReminders(Request $request, ManageIntegrations $jobs): JsonResponse
    {
        return response()->json(['data' => $jobs->run(RemindTravelDocuments::CODE, $this->user($request))], 202);
    }

    public function settings(Request $request, SaveTravelDocSettings $settings): JsonResponse
    {
        $data = $request->validate([
            'reminder_days' => ['required', 'array', 'min:1', 'max:6'],
            'reminder_days.*' => ['integer', 'between:1,120'],
            'channels' => ['sometimes', 'array', 'min:1'],
            'channels.*' => [Rule::in(TravelDocRules::CHANNELS)],
            'passport_months' => ['sometimes', 'integer', 'between:0,24'],
            'visa_nationalities' => ['sometimes', 'array', 'max:60'],
            'visa_nationalities.*' => ['string', 'min:3', 'max:40'],
            'insurance_trekking' => ['sometimes', 'boolean'],
        ], [
            'reminder_days.required' => 'Indica al menos un día de aviso.',
            'reminder_days.min' => 'Indica al menos un día de aviso.',
            'reminder_days.max' => 'Usa hasta 6 avisos.',
            'reminder_days.*.*' => 'Cada aviso va de 1 a 120 días antes del viaje.',
            'channels.*' => 'Elige al menos un canal: Email o WhatsApp.',
            'passport_months.*' => 'La vigencia mínima del pasaporte va de 0 a 24 meses.',
            'visa_nationalities.*' => 'Escribe cada nacionalidad con al menos 3 letras.',
            'insurance_trekking.*' => 'Indica si el seguro es obligatorio en trekking.',
        ]);

        return response()->json(['data' => $settings->save($data, $this->user($request))]);
    }

    public function upload(Request $request, string $code, string $passenger, string $type, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png'],
            'doc_number' => ['nullable', 'string', 'max:40'],
            'expiry_date' => ['nullable', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:300'],
        ], [
            'file.max' => 'El archivo pesa más de 10 MB.',
            'file.*' => 'Sube el documento en PDF, JPG o PNG.',
            'doc_number.*' => 'Revisa el número del documento.',
            'expiry_date.*' => 'Revisa la fecha de vencimiento.',
            'note.*' => 'La nota admite hasta 300 caracteres.',
        ]);
        $file = $request->file('file');
        assert($file instanceof UploadedFile);

        return response()->json(['data' => $workflow->upload($code, $passenger, $type, $file, $data, $this->user($request))], 201);
    }

    public function file(Request $request, string $code, string $passenger, string $type, TravelDocWorkflow $workflow): StreamedResponse
    {
        $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La reserva no tiene checklist documental.');
        $document = $workflow->file($code, $passenger, $type);
        $disk = Storage::disk((string) $document->storage_disk);

        if (! $disk->exists((string) $document->storage_path)) {
            throw ApiException::notFound('El archivo ya no está disponible.');
        }

        return $disk->download((string) $document->storage_path, (string) $document->file_name, ['Content-Type' => (string) $document->mime_type, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function contact(Request $request, string $code, string $passenger, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'phone' => ['required', 'string', 'min:6', 'max:30', 'regex:/^[0-9+()\s-]+$/'],
            'relation' => ['required', Rule::in(TravelDocRules::RELATIONS)],
        ], [
            'name.*' => 'Escribe el nombre del contacto.',
            'phone.*' => 'Escribe un teléfono válido, por ejemplo +51 984 112 233.',
            'relation.*' => 'Elige la relación con el pasajero.',
        ]);
        $workflow->saveContact($code, $passenger, $data, $this->user($request));

        return response()->json(['data' => ['passenger' => $passenger]]);
    }

    public function attention(Request $request, string $code, string $passenger, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'requires_attention' => ['required', 'boolean'],
            'operational_note' => ['nullable', 'string', 'max:300', 'required_if:requires_attention,true,1'],
        ], [
            'requires_attention.*' => 'Indica si requiere atención especial.',
            'operational_note.required_if' => 'Describe la indicación operativa.',
            'operational_note.*' => 'La nota admite hasta 300 caracteres.',
        ]);
        $workflow->saveAttention($code, $passenger, $data, $this->user($request));

        return response()->json(['data' => ['passenger' => $passenger]]);
    }

    public function requestDocuments(Request $request, string $code, TravelDocWorkflow $workflow, EmailNotifications $notifications): JsonResponse
    {
        $data = $request->validate([
            'channels' => ['nullable', 'array'],
            'channels.*' => [Rule::in(TravelDocRules::CHANNELS)],
        ], ['channels.*' => 'Elige Email o WhatsApp.']);

        return response()->json(['data' => $workflow->requestFromClient($code, $data, $this->user($request), $notifications)], 201);
    }

    public function validateItem(Request $request, string $code, string $passenger, string $type, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'doc_number' => ['nullable', 'string', 'max:40'],
            'expiry_date' => ['nullable', 'date'],
        ], ['doc_number.*' => 'Revisa el número del documento.', 'expiry_date.*' => 'Revisa la fecha de vencimiento.']);

        return response()->json(['data' => ['id' => $workflow->validate($code, $passenger, $type, $data, $this->user($request))]]);
    }

    public function observe(Request $request, string $code, string $passenger, string $type, TravelDocWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica qué falta o qué debe corregirse (mínimo 5 caracteres).']);

        return response()->json(['data' => ['id' => $workflow->observe($code, $passenger, $type, $data['reason'], $this->user($request))]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
