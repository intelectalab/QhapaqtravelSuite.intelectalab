<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Events\BookingServiceCancelled;
use App\Domain\Booking\Events\BookingServiceConfirmed;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProviderServiceResponse
{
    public const OPEN = ['pendiente', 'solicitado'];

    public const LATE = ['confirmado'];

    public const REJECT_REASONS = ['Sin disponibilidad (sold out)', 'Fecha bloqueada por mantenimiento', 'Tarifa no vigente para la fecha', 'Cupo de grupo excedido', 'Otro'];

    private const SETTLED = ['confirmado', 'en_curso', 'completado'];

    private const CLOSED_RESERVATIONS = ['borrador', 'cancelada', 'completada'];

    private const COPIED = ['reservation_id', 'product_id', 'catalog_service_id', 'quote_item_id', 'provider_id', 'name', 'service_time', 'pax', 'currency', 'fx_rate', 'cost_amount', 'price_amount', 'is_required', 'requires_assignment', 'service_kind', 'pax_detail', 'kind', 'addon_id', 'rooms', 'nights'];

    public function __construct(private readonly CodeSequence $codes, private readonly AuditLogger $audit, private readonly SyncServicePayables $payables) {}

    public function confirm(string $serviceId, array $data, User $actor, string $source): object
    {
        $service = $this->lockOpen($serviceId);
        $code = Str::upper(trim((string) $data['confirmation_code']));

        if (mb_strlen($code) < 4) {
            throw ApiException::unprocessable('SUP-BR-06', 'El código de confirmación debe tener al menos 4 caracteres.');
        }

        $values = [
            'status' => 'confirmado',
            'confirmation_code' => $code,
            'confirmed_by_name' => $data['confirmed_by_name'] ?? null,
            'confirmed_by' => $actor->getKey(),
            'confirmed_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ];

        if (! empty($data['service_time'])) {
            $values['service_time'] = $data['service_time'];
        }

        DB::table('booking_reservation_services')->where('id', $service->id)->update($values);
        BookingServiceConfirmed::dispatch((string) $service->reservation_id, (string) $service->id);
        $request = $this->request($service, $actor);
        DB::table('ops_supplier_requests')->where('id', $request)->update([
            'status' => 'confirmado',
            'responded_at' => now(),
            'responded_by_user_id' => $actor->getKey(),
            'response_source' => $source,
            'confirmation_code' => $code,
            'note' => $data['note'] ?? null,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->settleReservation($service->reservation_id);
        $this->payables->handle((string) $service->reservation_id, $actor);

        return (object) ['service' => $service, 'request_id' => $request, 'code' => $code, 'alternative' => null];
    }

    public function reject(string $serviceId, array $data, User $actor, string $source, bool $late = false): object
    {
        $service = $this->lockOpen($serviceId, $late ? [...self::OPEN, ...self::LATE] : self::OPEN);
        $reason = (string) $data['reason'];

        if (! in_array($reason, self::REJECT_REASONS, true) || trim((string) ($data['note'] ?? '')) === '') {
            throw ApiException::unprocessable('SUP-BR-07', 'Indique el motivo y el detalle del rechazo.');
        }

        $alternative = null;
        if (! empty($data['alt_provider_id']) || ! empty($data['alt_date'])) {
            $alternative = $this->alternative($service, empty($data['alt_date']) ? null : (string) $data['alt_date'], empty($data['alt_provider_id']) ? null : (string) $data['alt_provider_id'], $actor);
        }

        DB::table('booking_reservation_services')->where('id', $service->id)->update([
            'status' => 'rechazado',
            'confirmation_code' => null,
            'reject_reason' => "{$reason}: ".trim((string) $data['note']),
            'replaced_by_id' => $alternative?->id,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        BookingServiceCancelled::dispatch((string) $service->reservation_id, (string) $service->id);
        $request = $this->request($service, $actor);
        DB::table('ops_supplier_requests')->where('id', $request)->update([
            'status' => 'rechazado',
            'responded_at' => now(),
            'responded_by_user_id' => $actor->getKey(),
            'response_source' => $source,
            'rejection_reason' => Str::limit($reason, 120, ''),
            'note' => trim((string) $data['note']),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $reservation = DB::table('booking_reservations')->where('id', $service->reservation_id)->first(['id', 'code', 'status']);
        if ($reservation !== null && $reservation->status === 'confirmada') {
            DB::table('booking_reservations')->where('id', $reservation->id)->update(['status' => 'pendiente_proveedor', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            $this->audit->log('Reserva', $reservation->code, 'cambio_estado', 'confirmada', 'pendiente_proveedor');
        }

        $this->payables->handle((string) $service->reservation_id, $actor);

        return (object) ['service' => $service, 'request_id' => $request, 'code' => null, 'alternative' => $alternative];
    }

    private function lockOpen(string $serviceId, array $open = self::OPEN): object
    {
        $reservationId = DB::table('booking_reservation_services')->where('id', $serviceId)->value('reservation_id') ?? throw ApiException::notFound();
        $reservationStatus = DB::table('booking_reservations')->where('id', $reservationId)->lock('for no key update')->value('status');
        $service = DB::table('booking_reservation_services')->where('id', $serviceId)->lock('for no key update')->first() ?? throw ApiException::notFound();

        if (! in_array($service->status, $open, true) || in_array($reservationStatus, self::CLOSED_RESERVATIONS, true)) {
            throw ApiException::conflict('SUP-BR-04', 'La solicitud ya fue respondida ('.str_replace('_', ' ', (string) $service->status).'). Para cambios contacte a Operaciones.');
        }

        return $service;
    }

    private function request(object $service, User $actor): string
    {
        $open = DB::table('ops_supplier_requests')->where('reservation_service_id', $service->id)->whereNull('deleted_at')->where('status', 'solicitado')->orderByDesc('requested_at')->value('id');

        if ($open) {
            return (string) $open;
        }

        $requester = $service->requested_by ?? DB::table('booking_reservations')->where('id', $service->reservation_id)->value('owner_id') ?? $actor->getKey();

        return (string) DB::table('ops_supplier_requests')->insertGetId([
            'reservation_service_id' => $service->id,
            'provider_id' => $service->provider_id,
            'status' => 'solicitado',
            'channel' => 'extranet',
            'requested_at' => $service->requested_at ?? now(),
            'requested_by' => $requester,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ], 'id');
    }

    private function alternative(object $service, ?string $date, ?string $providerId, User $actor): object
    {
        if ($providerId === null && $date === $service->service_date) {
            throw ApiException::unprocessable('RES-BR-13', 'La fecha alternativa debe ser distinta a la solicitada.');
        }

        $provider = $providerId === null ? null : $this->alternativeProvider($service, $providerId);
        $code = $this->codes->next('booking_reservation_services', 'RS-');
        $values = collect((array) $service)->only(self::COPIED)->all();
        $id = (string) DB::table('booking_reservation_services')->insertGetId([
            ...$values,
            'code' => $code,
            'service_date' => $date ?? $service->service_date,
            'provider_id' => $provider->id ?? $service->provider_id,
            'status' => 'pendiente',
            'alt_of_id' => $service->id,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ], 'id');

        return (object) ['id' => $id, 'code' => $code, 'date' => $date ?? (string) $service->service_date, 'provider' => $provider->name ?? null];
    }

    public static function alternatives(?string $providerId): array
    {
        $type = $providerId === null ? null : DB::table('catalog_providers')->where('id', $providerId)->value('type');

        if ($type === null) {
            return [];
        }

        return DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->where('type', $type)->where('id', '<>', $providerId)
            ->orderBy('name')->get(['id', 'ref', 'name', 'city'])->map(fn (object $row): array => (array) $row)->all();
    }

    private function alternativeProvider(object $service, string $providerId): object
    {
        $provider = DB::table('catalog_providers')->whereNull('deleted_at')->where('id', $providerId)->first(['id', 'name', 'type', 'status']);
        $type = $service->provider_id ? DB::table('catalog_providers')->where('id', $service->provider_id)->value('type') : null;

        if ($provider === null || $provider->status !== 'activo' || $provider->id === $service->provider_id || ($type !== null && $provider->type !== $type)) {
            throw ApiException::unprocessable('RES-BR-13', 'Elige otro proveedor activo del mismo tipo.', ['alternative_provider_id' => ['Elige otro proveedor activo del mismo tipo.']]);
        }

        return $provider;
    }

    private function settleReservation(string $reservationId): void
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->first(['id', 'code', 'status']);

        if ($reservation === null || $reservation->status !== 'pendiente_proveedor') {
            return;
        }

        $waiting = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->where('is_required', true)
            ->whereNotIn('status', [...self::SETTLED, 'cancelado'])
            ->where(fn ($query) => $query->where('status', '<>', 'rechazado')->orWhereNull('replaced_by_id'))
            ->exists();

        if (! $waiting) {
            DB::table('booking_reservations')->where('id', $reservationId)->update(['status' => 'confirmada', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            $this->audit->log('Reserva', $reservation->code, 'cambio_estado', 'pendiente_proveedor', 'confirmada');
        }
    }
}
