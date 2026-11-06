<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\ClaimBookWorkflow;
use App\Domain\Crm\Support\ClaimBookDirectory;
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
        $data = $request->validate(['sede_id' => ['required', 'uuid'], ...$this->sheetRules()], ['sede_id.*' => 'Elige la sede.', ...$this->sheetMessages()]);

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

    public function close(Request $request, string $code, ClaimBookWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:1000']], ['note.*' => 'Explica el motivo del cierre.']);
        $workflow->close($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function sheetRules(): array
    {
        return [
            'type' => ['required', 'in:'.implode(',', array_keys(ClaimBookDirectory::TYPES))],
            'consumer_name' => ['required', 'string', 'min:3', 'max:160'],
            'consumer_doc_type' => ['required', 'in:DNI,CE,Pasaporte,RUC'],
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
            'consumer_email.*' => 'Revisa el correo del consumidor.',
            'good_kind.*' => 'Indica si es un servicio o un producto.',
            'good_description.*' => 'Describe el bien contratado.',
            'good_amount.*' => 'Revisa el monto.',
            'detail.*' => 'Escribe el detalle (mínimo 10 caracteres).',
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
