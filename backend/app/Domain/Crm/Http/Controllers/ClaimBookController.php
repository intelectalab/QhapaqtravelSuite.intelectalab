<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ClaimBookWorkflow;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ClaimBookController
{
    public function index(Request $request, ClaimBookDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
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
        $workflow->evaluate($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function respond(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:Procedente,Procedente en parte,No procedente'],
            'text' => ['required', 'string', 'min:20', 'max:4000'],
            'actions' => ['nullable', 'string', 'max:1000'],
        ], ['decision.*' => 'Elige la decisión.', 'text.*' => 'Escribe la respuesta al consumidor (mínimo 20 caracteres).']);
        $workflow->respond($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function settings(Request $request, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'response_days' => ['required', 'integer', 'between:1,30'],
            'alert_days' => ['required', 'integer', 'between:0,10'],
            'retention_years' => ['required', 'integer', 'between:2,20'],
        ], [
            'response_days.*' => 'El plazo de respuesta va de 1 a 30 días hábiles.',
            'alert_days.*' => 'La alerta previa va de 0 a 10 días hábiles.',
            'retention_years.*' => 'Las hojas se conservan entre 2 y 20 años.',
        ]);

        return response()->json(['data' => $workflow->saveSettings($data, $this->user($request))]);
    }

    public function close(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:1000']], ['note.*' => 'Explica el motivo del cierre.']);
        $workflow->close($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
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
