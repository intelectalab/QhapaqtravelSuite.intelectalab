<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\QuoteBuilder;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Quotes\Http\Requests\QuoteSaveRequest;
use App\Domain\Quotes\Support\QuoteDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class QuoteController
{
    public function __construct(private readonly QuoteDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La cotización no existe o pertenece a otro asesor.')]);
    }

    public function formOptions(Request $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => $builder->options($this->user($request))]);
    }

    public function preview(QuoteSaveRequest $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => $builder->preview($request->validated(), $this->user($request))]);
    }

    public function store(QuoteSaveRequest $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => ['code' => $builder->create($request->validated(), $this->user($request))]], 201);
    }

    public function update(QuoteSaveRequest $request, string $code, QuoteBuilder $builder): JsonResponse
    {
        $builder->update($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function newVersion(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $lifecycle->newVersion($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function requestInternal(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:500']], ['note.*' => 'Explica por qué se necesita el descuento o el margen.']);
        $lifecycle->requestInternal($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function decideInternal(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['approve' => ['required', 'boolean'], 'note' => ['nullable', 'string', 'max:500']]);
        $lifecycle->decideInternal($code, (bool) $data['approve'], $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function send(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:Email,WhatsApp,Portal'],
            'recipient' => ['required', 'string', 'max:200'],
            'message' => ['nullable', 'string', 'max:2000'],
        ], ['channel.*' => 'Elige cómo enviarla.', 'recipient.required' => 'Escribe a quién se envía.']);
        $lifecycle->send($code, $data['channel'], $data['recipient'], $data['message'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function negotiate(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:Llamada,Reunión,Email,WhatsApp'],
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ], ['note.*' => 'Cuenta qué pidió el cliente.']);
        $lifecycle->negotiate($code, $data['channel'], $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function approve(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'approved_by_name' => ['required', 'string', 'max:150'],
            'channel' => ['required', 'string', 'max:60'],
            'ref' => ['nullable', 'string', 'max:200'],
            'internal_approval' => ['nullable', 'boolean'],
            'internal_note' => ['nullable', 'string', 'max:500'],
        ], ['approved_by_name.required' => 'Escribe quién aprobó.', 'channel.required' => 'Indica por dónde aprobó.']);
        $lifecycle->approve($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reject(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']], ['reason.*' => 'Escribe el motivo del rechazo.']);
        $lifecycle->reject($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroy(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']], ['reason.*' => 'Escribe por qué se elimina.']);
        $lifecycle->delete($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
