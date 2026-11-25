<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\OtaWebhookEvents;
use App\Domain\Growth\Ota\OtaBookingConversion;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class OtaWebhookController
{
    public function __invoke(Request $request, string $ota, TenantDatabase $database, OtaWebhookEvents $events, OtaBookingConversion $conversion): JsonResponse
    {
        if (! in_array($ota, OtaWebhookEvents::OTAS, true)) {
            throw ApiException::notFound('La OTA indicada no está soportada.');
        }

        $raw = $request->getContent();
        $event = Validator::make((array) json_decode($raw, true), [
            'event' => ['required', 'in:'.implode(',', OtaWebhookEvents::EVENTS)],
            'tenant_id' => ['required', 'uuid'],
            'connection' => ['required', 'string', 'max:30'],
            'booking' => ['required', 'array'],
            'booking.ref' => ['required', 'string', 'max:120'],
            'booking.product_ref' => ['required_if:event,booking.created', 'nullable', 'string', 'max:120'],
            'booking.option_ref' => ['nullable', 'string', 'max:120'],
            'booking.travel_date' => ['nullable', 'date'],
            'booking.pax' => ['nullable', 'integer', 'between:1,99'],
            'booking.gross_amount' => ['nullable', 'regex:/^\d{1,12}(\.\d{1,2})?$/'],
            'booking.net_amount' => ['nullable', 'regex:/^\d{1,12}(\.\d{1,2})?$/'],
            'booking.currency' => ['nullable', 'in:PEN,USD,EUR'],
            'booking.customer' => ['nullable', 'array'],
            'booking.customer.name' => ['nullable', 'string', 'max:200'],
            'booking.customer.email' => ['nullable', 'email', 'max:190'],
            'booking.customer.phone' => ['nullable', 'string', 'max:40'],
            'booking.customer.country' => ['nullable', 'string', 'max:80'],
            'booking.customer.doc_type' => ['nullable', 'in:'.implode(',', OtaBookingConversion::CLIENT_DOC_TYPES)],
            'booking.customer.doc_number' => ['nullable', 'string', 'max:20', 'regex:/^\S+$/'],
        ], ['*' => 'El evento de la OTA no tiene el formato esperado.'])->validate();

        $tenant = (string) $event['tenant_id'];

        if (! DB::connection('pgsql_platform')->table('tenants')->where('id', $tenant)->exists()) {
            throw ApiException::notFound('La agencia del evento no existe.');
        }

        $result = $database->run($tenant, function () use ($events, $ota, $event, $raw, $request): array {
            $connection = $events->connection($ota, (string) $event['connection']);
            $events->verify($connection, $raw, (string) $request->header(OtaWebhookEvents::SIGNATURE_HEADER, ''));

            return $events->apply($connection, $event);
        });

        $bookingId = $result['booking_id'] ?? null;
        unset($result['booking_id']);

        if ($bookingId !== null && $result['result'] === 'recibida') {
            $outcome = $conversion->automatic($bookingId);
            $result = [...$result, 'status' => $outcome['status'], 'reservation' => $outcome['reservation'], 'reason' => $outcome['error']];
        }

        if ($bookingId !== null && $result['result'] === 'cancelada') {
            $conversion->cancelled($bookingId);
        }

        return response()->json(['data' => [...$result, 'ref' => $event['booking']['ref']]]);
    }
}
