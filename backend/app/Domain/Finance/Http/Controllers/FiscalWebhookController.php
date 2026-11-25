<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\QueryFiscalStatus;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Fake\FakeFiscalGateway;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use App\Domain\Platform\Support\OseCatalog;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class FiscalWebhookController
{
    public function __invoke(Request $request, string $provider, FiscalGateway $adapter, TenantDatabase $database, QueryFiscalStatus $query, OseCatalog $catalog, FiscalWebhookSecret $keys): JsonResponse
    {
        $ose = $catalog->find($provider) ?? throw ApiException::notFound('El OSE indicado no está en el catálogo de KipuControl.');
        $raw = $request->getContent();
        $signature = (string) $request->header(FakeFiscalGateway::SIGNATURE_HEADER, '');
        $key = $keys->signedWith($ose['code'], $raw, $signature, fn (string $body, string $sent, string $secret): bool => $adapter->verifyWebhook($body, $sent, $secret));

        if ($key === null) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', $keys->secrets($ose['code']) === [] ? "Falta generar la clave de firma de {$ose['name']} en la consola." : 'La firma del webhook no es válida.');
        }

        $keys->recordSigned($ose['code'], $key);

        $event = Validator::make((array) json_decode($raw, true), [
            'ticket' => ['required', 'string', 'max:80'],
            'status' => ['required', 'in:'.implode(',', QueryFiscalStatus::RESPONSES)],
            'code' => ['nullable', 'string', 'max:10'],
            'message' => ['nullable', 'string', 'max:500'],
            'tenant_id' => ['nullable', 'uuid'],
        ], [
            'ticket.required' => 'Falta el ticket del OSE.',
            'status.required' => 'Falta el estado de la respuesta del OSE.',
            'status.in' => 'El estado debe ser aceptado, observado o rechazado.',
            'tenant_id.uuid' => 'La agencia indicada no tiene un identificador válido.',
        ])->validate();

        $tenants = DB::connection('pgsql_platform')->table('fin_invoices')->where('ose_ticket', $event['ticket'])->limit(2)->pluck('tenant_id')->map(fn (mixed $id): string => (string) $id)->unique()->values();

        if ($tenants->isEmpty()) {
            throw ApiException::notFound('No hay un comprobante con ese ticket del OSE.');
        }

        if (isset($event['tenant_id']) && ! $tenants->contains($event['tenant_id'])) {
            throw ApiException::unprocessable('FIN-WEBHOOK-TENANT', 'El comprobante del ticket no pertenece a la agencia indicada.', ['tenant_id' => ['No coincide con la agencia del comprobante.']]);
        }

        if ($tenants->count() > 1 && ! isset($event['tenant_id'])) {
            throw ApiException::conflict('FIN-WEBHOOK-TENANT', 'El ticket existe en más de una agencia: indica la agencia del comprobante.');
        }

        $tenant = (string) ($event['tenant_id'] ?? $tenants->first());
        $result = $database->run($tenant, fn (): array => $query->fromWebhook((string) $event['ticket'], (string) $event['status'], $event['code'] ?? null, $event['message'] ?? null));

        return response()->json(['data' => [...$result, 'ticket' => $event['ticket']]]);
    }
}
