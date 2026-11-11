<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\QuoteAccessTokens;
use App\Domain\Quotes\Actions\QuoteAlternativeVersion;
use App\Domain\Quotes\Actions\QuoteBuilder;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Quotes\Http\Requests\QuoteSaveRequest;
use App\Domain\Quotes\Support\QuoteDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class QuoteController
{
    public const EVIDENCE = ['Aceptación en portal (enlace con token)', 'Correo electrónico del cliente', 'Mensaje de WhatsApp', 'Firma de conformidad', 'Orden de compra / servicio'];

    public function __construct(private readonly QuoteDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->directory->list($this->user($request), $request));
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw Portfolio::missing($this->user($request), 'quote_quotes', $code, 'La cotización no existe.', 'Esta cotización')]);
    }

    public function formOptions(Request $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => $builder->options($this->user($request))]);
    }

    public function preview(QuoteSaveRequest $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => $builder->preview($request->validated(), $this->user($request), $request->step())]);
    }

    public function store(QuoteSaveRequest $request, QuoteBuilder $builder): JsonResponse
    {
        return response()->json(['data' => ['code' => $builder->create($request->validated(), $this->user($request))]], 201);
    }

    public function update(QuoteSaveRequest $request, string $code, int $version, QuoteBuilder $builder): JsonResponse
    {
        $current = $this->directory->find($this->user($request), $code) ?? throw $this->missing($request, $code);

        if ((int) $current['version'] !== $version) {
            throw ApiException::conflict('QTE-BR-10', "Solo se edita la versión vigente (v{$current['version']}). Las anteriores quedan como historial.");
        }

        $builder->update($code, $request->validated(), (int) $request->input('lock_version'), $this->user($request));

        return response()->json(['data' => ['code' => $code, 'version' => $version]]);
    }

    public function kpis(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->kpisFor($this->user($request), $request)]);
    }

    public function versions(Request $request, string $code): JsonResponse
    {
        $data = $this->directory->versions($this->user($request), $code) ?? throw $this->missing($request, $code);

        return response()->json(['data' => $data['versions'], 'meta' => ['code' => $data['code'], 'current' => $data['current'], 'see_margin' => $data['see_margin']]]);
    }

    public function version(Request $request, string $code, int $version): JsonResponse
    {
        $this->directory->find($this->user($request), $code) ?? throw $this->missing($request, $code);

        return response()->json(['data' => $this->directory->versionOf($this->user($request), $code, $version) ?? throw ApiException::notFound("La versión {$version} no existe.")]);
    }

    public function compare(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['a' => ['required', 'integer', 'min:1'], 'b' => ['required', 'integer', 'min:1', 'different:a']], ['a.*' => 'Elige dos versiones distintas para comparar.', 'b.*' => 'Elige dos versiones distintas para comparar.']);
        $this->directory->find($this->user($request), $code) ?? throw $this->missing($request, $code);

        return response()->json(['data' => $this->directory->compare($this->user($request), $code, (int) $data['a'], (int) $data['b']) ?? throw ApiException::notFound('Una de las versiones no existe.')]);
    }

    public function activity(Request $request, string $code): JsonResponse
    {
        return response()->json($this->directory->activity($this->user($request), $request, $code) ?? throw $this->missing($request, $code));
    }

    public function duplicate(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']]);

        return response()->json(['data' => ['code' => $lifecycle->duplicate($code, $data['note'] ?? null, $this->user($request)), 'source' => $code]], 201);
    }

    public function reassign(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['owner_id' => ['required', 'uuid'], 'note' => ['nullable', 'string', 'max:300']], ['owner_id.*' => 'Elige el asesor que la atenderá.']);
        $lifecycle->reassign($code, $data['owner_id'], $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function decideVersion(Request $request, string $code, int $version, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', 'in:approve,reject'], 'note' => ['nullable', 'string', 'max:500']], ['decision.*' => 'Indica si apruebas o no la versión.']);
        $lifecycle->decideInternal($code, $data['decision'] === 'approve', $data['note'] ?? null, $this->user($request), $version);

        return response()->json(['data' => ['code' => $code, 'version' => $version, 'decision' => $data['decision']]]);
    }

    private function missing(Request $request, string $code): ApiException
    {
        return Portfolio::missing($this->user($request), 'quote_quotes', $code, 'La cotización no existe.', 'Esta cotización');
    }

    public function newVersion(Request $request, string $code, QuoteLifecycle $lifecycle, QuoteAlternativeVersion $alternative): JsonResponse
    {
        $data = $request->validate([
            'dates' => ['nullable', 'array', 'max:60'],
            'dates.*.line' => ['required', 'integer', 'min:1', 'distinct'],
            'dates.*.date' => ['required', 'date'],
        ], ['dates.*.line.*' => 'Elige la línea que cambia de fecha.', 'dates.*.date.*' => 'Elige una fecha alternativa válida.']);

        if (! empty($data['dates'])) {
            return response()->json(['data' => ['code' => $code, 'version' => $alternative->handle($code, $data['dates'], $this->user($request))]]);
        }

        $lifecycle->newVersion($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function requestInternal(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:500']], ['note.*' => 'Explica por qué se necesita el descuento o el margen.']);
        $lifecycle->requestInternal($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function send(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'channels' => ['required_without:channel', 'array', 'min:1', 'max:3'],
            'channels.*' => ['string', 'in:Email,WhatsApp,Portal,email,whatsapp,portal'],
            'channel' => ['nullable', 'in:Email,WhatsApp,Portal'],
            'recipient' => ['nullable', 'string', 'max:200'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:2000'],
        ], ['channels.*' => 'Elige al menos un canal.', 'channels.required_without' => 'Elige al menos un canal.']);
        $names = array_combine(array_map('mb_strtolower', QuoteLifecycle::SEND_CHANNELS), QuoteLifecycle::SEND_CHANNELS);
        $channels = array_map(fn (string $channel): string => $names[mb_strtolower($channel)], $data['channels'] ?? [$data['channel']]);
        $recipient = $data['recipient'] ?? null;
        $to = ['email' => $recipient !== null && str_contains($recipient, '@') ? $recipient : null, 'phone' => $data['phone'] ?? ($recipient !== null && ! str_contains($recipient, '@') ? $recipient : null)];

        return response()->json(['data' => $lifecycle->send($code, $channels, $to, $data['message'] ?? null, $this->user($request))]);
    }

    public function token(Request $request, string $code, QuoteAccessTokens $tokens): JsonResponse
    {
        return response()->json(['data' => $tokens->regenerate($code, $this->user($request))]);
    }

    public function recordView(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']]);
        $lifecycle->recordView($code, $data['note'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function negotiate(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:Llamada,Reunión,Email,WhatsApp'],
            'note' => ['required', 'string', 'min:3', 'max:1000'],
            'new_version' => ['nullable', 'boolean'],
        ], ['note.*' => 'Cuenta qué pidió el cliente.']);

        if (! empty($data['new_version']) && ! $this->user($request)->can('quotes.create')) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo quien arma cotizaciones crea una nueva versión.', ['quotes.create']);
        }

        $lifecycle->negotiate($code, $data['channel'], $data['note'], $this->user($request), (bool) ($data['new_version'] ?? false));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function approve(Request $request, string $code, QuoteLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'approved_by_name' => ['required', 'string', 'max:150'],
            'channel' => ['required', Rule::in(self::EVIDENCE)],
            'ref' => ['required', 'string', 'min:3', 'max:200'],
            'internal_approval' => ['nullable', 'boolean'],
            'internal_note' => ['nullable', 'string', 'max:500'],
        ], ['approved_by_name.required' => 'Escribe quién aprobó.', 'channel.*' => 'Elige el tipo de evidencia de la aprobación.', 'ref.*' => 'Escribe la referencia de la evidencia: asunto del correo, número de orden o fecha del mensaje.']);
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
