<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Data\PaymentWebhook;
use App\Domain\Integrations\Fake\FakePaymentGateway;
use App\Domain\Integrations\Payments\Adapters\InvalidWebhookSignature;
use App\Domain\Integrations\Payments\AgencyPaymentGateways;
use App\Domain\Integrations\Payments\ConnectorCatalog;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Domain\Site\Actions\PaymentWebhookEvents;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class PaymentWebhookController
{
    public function __invoke(Request $request, string $gateway, PaymentGateway $adapter, TenantDatabase $database, PaymentWebhookEvents $events): JsonResponse
    {
        if (ConnectorCatalog::has($gateway)) {
            return $this->connector($request, $gateway, $database, $events);
        }

        $driver = (string) config('integrations.drivers.payments', 'fake');

        if ($gateway !== $driver && ! ($driver === 'fake' && $gateway === FakePaymentGateway::NAME)) {
            throw ApiException::notFound('La pasarela indicada no está configurada.');
        }

        $raw = $request->getContent();

        if (! $adapter->verifyWebhook($raw, (string) $request->header(FakePaymentGateway::SIGNATURE_HEADER, ''))) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', 'La firma del webhook no es válida.');
        }

        $event = Validator::make((array) json_decode($raw, true), [
            'id' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:'.implode(',', PaymentWebhookEvents::TYPES)],
            'data' => ['required', 'array'],
            'data.tenant_id' => ['required', 'uuid'],
            'data.reference' => ['required', 'string', 'max:40'],
            'data.scope' => ['nullable', 'in:'.implode(',', PaymentWebhookEvents::SCOPES)],
            'data.method' => ['nullable', 'in:'.implode(',', array_keys(PaymentLinks::METHODS))],
            'data.txn_id' => ['nullable', 'string', 'max:80'],
            'data.code' => ['nullable', 'string', 'max:20'],
            'data.masked' => ['nullable', 'string', 'max:20'],
            'data.message' => ['nullable', 'string', 'max:200'],
            'data.three_ds' => ['nullable', 'string', 'max:40'],
        ])->validate();

        $tenant = (string) $event['data']['tenant_id'];

        if (! DB::connection('pgsql_platform')->table('tenants')->where('id', $tenant)->exists()) {
            throw ApiException::notFound('El comercio del evento no existe.');
        }

        return $this->apply($gateway, $tenant, $event, $database, $events);
    }

    private function connector(Request $request, string $gateway, TenantDatabase $database, PaymentWebhookEvents $events): JsonResponse
    {
        $subdomain = strtolower((string) $request->query('agencia', ''));
        $accountId = (string) $request->query('cuenta', '');
        $tenant = $subdomain === '' ? null : DB::connection('pgsql_platform')->table('tenants')->where('subdomain', $subdomain)->value('id');

        if ($tenant === null || ! Str::isUuid($accountId)) {
            throw ApiException::notFound('No hay una pasarela conectada para esta dirección.');
        }

        $hook = new PaymentWebhook($request->getContent(), array_change_key_case($request->headers->all(), CASE_LOWER), $request->query(), $request->request->all());

        try {
            $event = $database->run((string) $tenant, function () use ($gateway, $accountId, $hook) {
                $gateways = app(AgencyPaymentGateways::class);
                $account = $gateways->find($accountId);

                if ($account === null || $account->provider !== $gateway) {
                    throw ApiException::notFound('No hay una pasarela conectada para esta dirección.');
                }

                return $gateways->connector($account)->webhook($hook);
            });
        } catch (InvalidWebhookSignature) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', 'La firma del webhook no es válida.');
        } catch (ConnectionException) {
            return response()->json(['data' => ['result' => 'reintentar']], 503);
        }

        if ($event === null) {
            return response()->json(['data' => ['result' => 'ignorado']]);
        }

        return $this->apply($gateway, (string) $tenant, $event->toEvent((string) $tenant), $database, $events);
    }

    private function apply(string $gateway, string $tenant, array $event, TenantDatabase $database, PaymentWebhookEvents $events): JsonResponse
    {
        $key = "payments:webhook:{$gateway}:".hash('sha256', $tenant.'|'.$event['id']);

        if (Cache::has($key)) {
            return response()->json(['data' => ['result' => 'duplicado', 'event' => $event['id']]]);
        }

        $result = $database->run($tenant, fn (): array => $events->apply($gateway, $event));
        Cache::put($key, true, now()->addDays(30));

        return response()->json(['data' => [...$result, 'event' => $event['id']]]);
    }
}
