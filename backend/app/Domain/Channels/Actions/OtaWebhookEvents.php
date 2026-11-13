<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class OtaWebhookEvents
{
    public const SIGNATURE_HEADER = 'X-Ota-Signature';

    public const EVENTS = ['booking.created', 'booking.modified', 'booking.cancelled'];

    public const OTAS = ['viator', 'getyourguide', 'expedia', 'google_ttd', 'civitatis', 'otro'];

    public function __construct(private readonly TenantContext $context, private readonly AuditLogger $audit) {}

    public function connection(string $ota, string $code): object
    {
        $connection = DB::table('channel_ota_connections')->where('code', $code)->where('ota', $ota)->first(['id', 'code', 'ota', 'status', 'webhook_secret_encrypted']);

        if ($connection === null || in_array($connection->status, ['borrador', 'desconectado'], true)) {
            throw ApiException::notFound('La conexión con la OTA no existe o está desconectada.');
        }

        return $connection;
    }

    public function verify(object $connection, string $raw, string $signature): void
    {
        try {
            $secret = $connection->webhook_secret_encrypted ? Crypt::decryptString((string) $connection->webhook_secret_encrypted) : '';
        } catch (DecryptException) {
            $secret = '';
        }

        if ($secret === '' || $signature === '' || ! hash_equals(hash_hmac('sha256', $raw, $secret), $signature)) {
            throw ApiException::unauthorized('WEBHOOK_SIGNATURE_INVALID', 'La firma de la OTA no es válida.');
        }
    }

    public function apply(object $connection, array $event): array
    {
        $booking = $event['booking'];
        $existing = DB::table('channel_ota_bookings')->where('connection_id', $connection->id)->where('ota_booking_ref', $booking['ref'])->lock('for no key update')->first(['id', 'status']);

        return match ($event['event']) {
            'booking.created' => $existing !== null ? ['result' => 'duplicado', 'status' => $existing->status] : $this->create($connection, $booking, $event),
            'booking.modified' => $this->modify($connection, $existing, $booking, $event),
            default => $this->cancel($connection, $existing, $booking, $event),
        };
    }

    private function create(object $connection, array $booking, array $event): array
    {
        $mapping = DB::table('channel_ota_product_mappings')->where('connection_id', $connection->id)->where('ota_product_ref', $booking['product_ref'])
            ->when(! empty($booking['option_ref']), fn ($query) => $query->where(fn ($scope) => $scope->whereNull('ota_option_ref')->orWhere('ota_option_ref', $booking['option_ref'])))
            ->where('status', 'activo')->orderByRaw('ota_option_ref is null')->first(['id']);
        $status = $mapping === null ? 'rechazada' : 'recibida';

        DB::table('channel_ota_bookings')->insert([
            'tenant_id' => $this->context->idOrFail(),
            'connection_id' => $connection->id,
            'ota_booking_ref' => $booking['ref'],
            'mapping_id' => $mapping?->id,
            'payload' => json_encode($event, JSON_UNESCAPED_UNICODE),
            'gross_amount' => $booking['gross_amount'] ?? null,
            'net_amount' => $booking['net_amount'] ?? null,
            'currency' => $booking['currency'] ?? null,
            'travel_date' => $booking['travel_date'] ?? null,
            'pax' => $booking['pax'] ?? null,
            'status' => $status,
            'error' => $mapping === null ? 'El producto de la OTA no tiene un mapeo activo en el catálogo.' : null,
            'processed_at' => $mapping === null ? now() : null,
        ]);
        $this->audit->log('Reserva OTA', $connection->code.'/'.$booking['ref'], 'recibir', after: $status.($mapping === null ? ' · sin mapeo' : ''));

        return ['result' => $status, 'status' => $status];
    }

    private function modify(object $connection, ?object $existing, array $booking, array $event): array
    {
        if ($existing === null) {
            throw ApiException::notFound('La reserva de la OTA no existe.');
        }

        if ($existing->status !== 'recibida') {
            throw ApiException::conflict('OTA_BOOKING_LOCKED', 'La reserva ya fue procesada; los cambios se gestionan desde el back-office.');
        }

        DB::table('channel_ota_bookings')->where('id', $existing->id)->update([
            'payload' => json_encode($event, JSON_UNESCAPED_UNICODE),
            'travel_date' => $booking['travel_date'] ?? null,
            'pax' => $booking['pax'] ?? null,
            'gross_amount' => $booking['gross_amount'] ?? null,
            'net_amount' => $booking['net_amount'] ?? null,
        ]);
        $this->audit->log('Reserva OTA', $connection->code.'/'.$booking['ref'], 'modificar', after: 'recibida');

        return ['result' => 'actualizada', 'status' => 'recibida'];
    }

    private function cancel(object $connection, ?object $existing, array $booking, array $event): array
    {
        if ($existing === null) {
            throw ApiException::notFound('La reserva de la OTA no existe.');
        }

        if ($existing->status === 'cancelada') {
            return ['result' => 'duplicado', 'status' => 'cancelada'];
        }

        if (! in_array($existing->status, ['recibida', 'confirmada'], true)) {
            throw ApiException::conflict('OTA_BOOKING_LOCKED', 'La reserva de la OTA está '.$existing->status.' y no se puede cancelar.');
        }

        DB::table('channel_ota_bookings')->where('id', $existing->id)->update(['status' => 'cancelada', 'processed_at' => now(), 'payload' => json_encode($event, JSON_UNESCAPED_UNICODE)]);
        $this->audit->log('Reserva OTA', $connection->code.'/'.$booking['ref'], 'cancelar', $existing->status, 'cancelada');

        return ['result' => 'cancelada', 'status' => 'cancelada'];
    }
}
