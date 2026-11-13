<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Crm\Actions\ClaimBookWorkflow;
use App\Domain\Crm\Actions\ExportClaimBook;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\ClaimCertificate;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Http\Middleware\IdempotencyMiddleware;
use App\Jobs\AlertClaimDeadlines;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ClaimBookController
{
    public function index(Request $request, ClaimBookDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function show(string $id, ClaimBookDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->find($id)]);
    }

    public function currentSettings(Request $request, ClaimBookDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->settingsView($this->user($request))]);
    }

    public function reports(Request $request, ClaimBookDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'group' => ['nullable', 'in:type,sede,month'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
        ], ['group.*' => 'Agrupa por type, sede o month.', 'year.*' => 'Revisa el año.']);

        return response()->json(['data' => $directory->report($data['group'] ?? 'type', (int) ($data['year'] ?? now()->year))]);
    }

    public function certificate(Request $request, string $id, ClaimCertificate $certificate): Response|JsonResponse
    {
        return $certificate->respond($id, $request);
    }

    public function export(Request $request, ExportClaimBook $export): JsonResponse
    {
        $data = $request->validate([
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'format' => ['nullable', 'in:'.implode(',', ExportClaimBook::FORMATS)],
        ], ['year.*' => 'Revisa el año.', 'format.in' => 'La relación se exporta en CSV, XLSX o PDF.']);

        return response()->json(['data' => $export((int) ($data['year'] ?? now()->year), (string) ($data['format'] ?? 'XLSX'), $this->user($request), $request->header(IdempotencyMiddleware::HEADER))], 202);
    }

    public function links(Request $request, string $id, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'client' => ['present', 'nullable', 'string', 'max:30'],
            'reservation' => ['present', 'nullable', 'string', 'max:30'],
        ], ['client.*' => 'Indica el cliente o déjalo vacío.', 'reservation.*' => 'Indica la reserva o déjala vacía.']);

        return response()->json(['data' => app(ClaimBookDirectory::class)->find($workflow->link($id, $data, $this->user($request)))]);
    }

    public function store(Request $request, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['sede_id' => ['required', 'uuid'], ...$this->sheetRules(), ...$this->registerRules($request)], ['sede_id.*' => 'Elige la sede.', ...$this->sheetMessages(), ...ClaimConsumer::guardianMessages(), 'email_consent.*' => 'El consumidor debe aceptar que la respuesta se le envíe al correo indicado.']);

        return response()->json(['data' => ['code' => $workflow->register($data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $workflow->update($code, $request->validate($this->sheetRules(), $this->sheetMessages()), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function evaluate(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['owner_id' => ['nullable', 'uuid'], 'note' => ['nullable', 'string', 'max:500']], ['owner_id.*' => 'Elige un responsable de la lista.']);
        $workflow->evaluate($code, $this->user($request), $data['owner_id'] ?? null, $data['note'] ?? null);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resend(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'sent_to' => $workflow->resend($code, $this->user($request))]]);
    }

    public function respond(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:Procedente,Procedente en parte,No procedente'],
            'text' => ['required', 'string', 'min:40', 'max:4000'],
            'actions' => ['required', 'string', 'min:10', 'max:1000'],
        ], ['decision.*' => 'Elige la decisión.', 'text.*' => 'Escribe una respuesta motivada al consumidor (mínimo 40 caracteres).', 'actions.*' => 'Describe las acciones adoptadas (mínimo 10 caracteres).']);
        $workflow->respond($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function settings(Request $request, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'response_days' => [Rule::requiredIf(! $request->has('holidays')), 'integer', 'between:1,30'],
            'alert_days' => [Rule::requiredIf(! $request->has('holidays')), 'integer', 'between:0,10'],
            'retention_years' => [Rule::requiredIf(! $request->has('holidays')), 'integer', 'between:2,20'],
            'holidays' => ['sometimes', 'present', 'array', 'max:80'],
            'holidays.*.date' => ['required', 'date_format:Y-m-d', 'distinct'],
            'holidays.*.name' => ['required', 'string', 'min:3', 'max:120'],
        ], [
            'response_days.*' => 'El plazo de respuesta va de 1 a 30 días hábiles.',
            'alert_days.*' => 'La alerta previa va de 0 a 10 días hábiles.',
            'retention_years.*' => 'Las hojas se conservan entre 2 y 20 años.',
            'holidays.max' => 'Registra hasta 80 feriados.',
            'holidays.*.date.distinct' => 'Esa fecha ya es feriado.',
            'holidays.*.date.*' => 'Indica la fecha del feriado.',
            'holidays.*.name.*' => 'Indica el nombre del feriado.',
        ]);

        return response()->json(['data' => $workflow->saveSettings($data, $this->user($request))]);
    }

    public function close(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', Rule::in(ClaimBookDirectory::CLOSE_REASONS)],
            'note' => ['required_without:reason', 'nullable', 'string', 'min:5', 'max:1000'],
        ], ['reason.*' => 'Elige un motivo de cierre de la lista.', 'note.*' => 'Explica el motivo del cierre.']);
        $reason = $data['reason'] ?? null;
        $note = trim((string) ($data['note'] ?? ''));
        $workflow->close($code, $reason !== null ? $reason.($note !== '' ? " — {$note}" : '') : $note, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function note(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:1000']], ['note.*' => 'Escribe la nota interna (mínimo 3 caracteres).']);
        $workflow->note($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function alerts(Request $request, ManageIntegrations $integrations): JsonResponse
    {
        $job = DB::table('sys_scheduled_jobs')->where('job_class', AlertClaimDeadlines::class)->value('code')
            ?? throw ApiException::conflict('LR-ALERTS', 'El aviso de vencimientos no está programado en esta agencia.');

        return response()->json(['data' => $integrations->run((string) $job, $this->user($request))], 202);
    }

    public function audit(string $code, ClaimBookDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->audit($code)]);
    }

    private function registerRules(Request $request): array
    {
        return [
            'consumer_doc_number' => ['required', 'string', ...ClaimConsumer::docRule($request->input('consumer_doc_type'))],
            'consumer_email' => ['required', 'email', 'max:160'],
            'consumer_address' => ['required', 'string', 'min:5', 'max:250'],
            'detail' => ['required', 'string', 'min:20', 'max:4000'],
            ...ClaimConsumer::guardianRules($request->input('guardian_doc_type')),
            'email_consent' => ['accepted'],
        ];
    }

    private function sheetRules(): array
    {
        return [
            'type' => ['required', 'in:'.implode(',', array_keys(ClaimBookDirectory::TYPES))],
            'consumer_name' => ['required', 'string', 'min:3', 'max:160'],
            'consumer_doc_type' => ['required', 'in:'.implode(',', ClaimConsumer::DOC_TYPES)],
            'consumer_doc_number' => ['required', 'string', 'min:6', 'max:20', 'regex:/^[A-Za-z0-9]+$/'],
            'consumer_email' => ['nullable', 'email', 'max:160'],
            'consumer_phone' => ['nullable', 'string', 'max:30'],
            'consumer_address' => ['nullable', 'string', 'max:250'],
            'good_kind' => ['required', 'in:Servicio,Producto'],
            'good_description' => ['required', 'string', 'min:3', 'max:250'],
            'good_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'good_currency' => ['nullable', 'in:PEN,USD'],
            'detail' => ['required', 'string', 'min:10', 'max:4000'],
            'request' => ['required', 'string', 'min:5', 'max:2000'],
            'client' => ['nullable', 'string', 'max:30'],
            'reservation' => ['nullable', 'string', 'max:30'],
        ];
    }

    private function sheetMessages(): array
    {
        return [
            'type.*' => 'Elige si es reclamo o queja.',
            'consumer_name.*' => 'Escribe el nombre del consumidor.',
            'consumer_doc_type.*' => 'Elige el tipo de documento.',
            'consumer_doc_number.*' => 'Revisa el número de documento (solo letras y números).',
            'consumer_email.*' => 'Escribe un correo válido: ahí se envían la constancia y la respuesta.',
            'consumer_address.*' => 'Escribe el domicilio del consumidor.',
            'good_kind.*' => 'Indica si es un servicio o un producto.',
            'good_description.*' => 'Describe el bien contratado.',
            'good_amount.*' => 'Revisa el monto.',
            'detail.*' => 'Escribe el detalle (mínimo 20 caracteres).',
            'request.*' => 'Escribe el pedido del consumidor.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
