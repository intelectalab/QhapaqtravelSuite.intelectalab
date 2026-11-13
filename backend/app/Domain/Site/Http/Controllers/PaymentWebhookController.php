<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Fake\FakePaymentGateway;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Domain\Site\Actions\PaymentWebhookEvents;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class PaymentWebhookController
{
    public function __invoke(Request $request, string $gateway, PaymentGateway $adapter, TenantDatabase $database, PaymentWebhookEvents $events): JsonResponse
    {
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
            'data.scope' => ['nullable', 'in:order,receivable,payment_link'],
            'data.method' => ['nullable', 'in:'.implode(',', array_keys(PaymentLinks::METHODS))],
            'data.txn_id' => ['nullable', 'string', 'max:80'],
            'data.code' => ['nullable', 'string', 'max:20'],
            'data.masked' => ['nullable', 'string', 'max:20'],
            'data.message' => ['nullable', 'string', 'max:200'],
            'data.three_ds' => ['nullable', 'string', 'max:40'],
        ])->validate();

        $key = "payments:webhook:{$gateway}:".hash('sha256', $event['id']);

        if (Cache::has($key)) {
            return response()->json(['data' => ['result' => 'duplicado', 'event' => $event['id']]]);
        }

        $tenant = (string) $event['data']['tenant_id'];

        if (! DB::connection('pgsql_platform')->table('tenants')->where('id', $tenant)->exists()) {
            throw ApiException::notFound('El comercio del evento no existe.');
        }

        $result = $database->run($tenant, fn (): array => $events->apply($gateway, $event));
        Cache::put($key, true, now()->addDays(30));

        return response()->json(['data' => [...$result, 'event' => $event['id']]]);
    }
}
