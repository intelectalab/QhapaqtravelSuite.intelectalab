<?php

declare(strict_types=1);

namespace App\Domain\Growth\Ota;

use App\Domain\Booking\Actions\CreateDirectReservation;
use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Events\ReservationCreated;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Booking\Support\DirectBookingPlan;
use App\Domain\Booking\Support\ReservationAssembler;
use App\Domain\Booking\Support\ReservationReceivables;
use App\Domain\Catalog\Support\RateResolver;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\InventoryLock;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;
use Throwable;

final class OtaBookingConversion
{
    public const CHANNEL = 'B2B';

    public const CURRENCIES = ['PEN', 'USD'];

    public const CLIENT_DOC_TYPES = ['DNI', 'PASAPORTE', 'CE'];

    private const CANCEL_REASON = 'Cliente desistió';

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $tenantDb,
        private readonly InventoryLock $inventory,
        private readonly DirectBookingPlan $plans,
        private readonly ReservationAssembler $assembler,
        private readonly ReservationReceivables $receivables,
        private readonly SyncServicePayables $payables,
        private readonly SequenceService $sequences,
        private readonly CodeSequence $codes,
        private readonly ReservationStateMachine $states,
        private readonly CreateDirectReservation $direct,
        private readonly GrowthRules $rules,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
    ) {}

    public function automatic(string $bookingId): array
    {
        $tenantId = $this->context->idOrFail();

        if (! $this->rules->enabled('R-OTA-CHANNEL')) {
            return $this->outcome($tenantId, $bookingId);
        }

        try {
            $owner = $this->tenantDb->run($tenantId, fn (): User => $this->owner($bookingId));
            $this->asTeam($tenantId);
            $client = $this->tenantDb->run($tenantId, fn (): ?object => $this->payloadClient($bookingId, $owner, true));

            if ($client === null) {
                $this->tenantDb->run($tenantId, fn () => $this->note($bookingId, 'Falta identificar al cliente: conviértela desde Reservas recibidas eligiendo uno de tu cartera.'));

                return $this->outcome($tenantId, $bookingId);
            }

            $this->run($tenantId, $bookingId, $client, (string) $owner->getKey(), $owner, 'automatica');
        } catch (ApiException $error) {
            $this->tenantDb->run($tenantId, fn () => $error->ruleCode === 'INVENTORY_BUSY' ? $this->note($bookingId, 'Otra venta estaba tomando los mismos cupos: vuelve a convertirla desde Reservas recibidas.') : $this->fail($bookingId, $error->getMessage()));
        } catch (Throwable $error) {
            report($error);
            $this->tenantDb->run($tenantId, fn () => $this->fail($bookingId, 'No pudimos crear la reserva por un error interno. Revisa los datos y vuelve a intentarlo.'));
        }

        return $this->outcome($tenantId, $bookingId);
    }

    public function convert(string $bookingId, ?string $clientRef, User $actor): array
    {
        $this->rules->ensure('R-OTA-CHANNEL', OtaChannel::PERMISSION);

        if (! $actor->can('reservations.create')) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no puede crear reservas.', ['reservations.create']);
        }

        $tenantId = $this->context->idOrFail();
        $booking = $this->booking($bookingId);

        if ($booking->status === 'confirmada') {
            return $this->outcome($tenantId, $bookingId);
        }

        if ($booking->status !== 'recibida') {
            throw ApiException::conflict('OTA_BOOKING_LOCKED', 'La reserva de la OTA está '.(OtaChannel::BOOKING_STATUSES[$booking->status] ?? $booking->status).' y ya no se convierte.');
        }

        if ($clientRef !== null && $clientRef !== '') {
            [$client, $ownerId] = $this->direct->parties(['client_id' => $clientRef], $actor);
        } else {
            $client = $this->payloadClient($bookingId, $actor, true)
                ?? throw ApiException::unprocessable('OTA_CLIENT_REQUIRED', 'Elige el cliente de la reserva.', ['client_id' => ['Elige un cliente de tu cartera.']]);
            $ownerId = (string) $actor->getKey();
        }

        $this->run($tenantId, $bookingId, $client, $ownerId, $actor, 'manual');

        return $this->outcome($tenantId, $bookingId);
    }

    public function cancelled(string $bookingId): void
    {
        $tenantId = $this->context->idOrFail();
        $row = $this->tenantDb->run($tenantId, fn (): ?object => DB::table('channel_ota_bookings as b')->join('booking_reservations as r', 'r.id', '=', 'b.reservation_id')
            ->where('b.id', $bookingId)->whereNotIn('r.status', ReservationWorkflow::CLOSED)->first(['b.id', 'b.ota_booking_ref', 'r.code', 'r.owner_id']));

        if ($row === null) {
            return;
        }

        try {
            $actor = $this->tenantDb->run($tenantId, fn (): User => User::query()->whereKey($row->owner_id)->whereNull('deleted_at')->where('status', 'activo')->first() ?? $this->owner($bookingId));
            $this->asTeam($tenantId);
            $this->tenantDb->run($tenantId, fn () => app(ReservationWorkflow::class)->cancel((string) $row->code, self::CANCEL_REASON, "La OTA canceló la reserva {$row->ota_booking_ref}.", $actor));
        } catch (Throwable $error) {
            if (! $error instanceof ApiException) {
                report($error);
            }

            $this->tenantDb->run($tenantId, fn () => DB::table('channel_ota_bookings')->where('id', $bookingId)->update(['error' => mb_substr("La OTA canceló, pero la reserva {$row->code} sigue vigente: cancélala desde Reservas. ".$error->getMessage(), 0, 500), 'updated_at' => now()]));
        }
    }

    public function suggestion(object $booking): ?array
    {
        $customer = self::customer($booking);

        if ($customer === null) {
            return null;
        }

        $client = $this->existingClient($customer);

        return [
            'name' => $customer['name'] ?? null,
            'email' => $customer['email'] ?? null,
            'client' => $client === null ? null : ['code' => $client->code, 'name' => $client->name],
            'creatable' => $client === null && self::creatable($customer),
        ];
    }

    public static function amounts(object $booking, ?object $mapping, string $commissionPct): array
    {
        $pax = (int) ($booking->pax ?? 0);
        $gross = $booking->gross_amount !== null
            ? Decimal::money((string) $booking->gross_amount)
            : ($mapping !== null && $mapping->price_mode === 'fijo' && $mapping->fixed_price !== null && $pax > 0 ? Decimal::round2(Decimal::money((string) $mapping->fixed_price)->multipliedBy($pax)) : null);

        if ($gross === null) {
            return ['gross' => null, 'net' => null, 'commission' => null];
        }

        $net = $booking->net_amount !== null
            ? Decimal::money((string) $booking->net_amount)
            : $gross->minus($gross->multipliedBy($commissionPct)->dividedBy(100, 2, RoundingMode::HALF_UP));

        return ['gross' => $gross, 'net' => $net, 'commission' => $gross->minus($net)];
    }

    private function run(string $tenantId, string $bookingId, object $client, string $ownerId, User $actor, string $origin): array
    {
        $setup = $this->tenantDb->run($tenantId, fn (): array => $this->setup($bookingId));

        if ($setup['reason'] !== null) {
            $this->tenantDb->run($tenantId, fn () => $this->reject($bookingId, $setup['reason'], $actor));

            return ['status' => 'rechazada', 'reason' => $setup['reason']];
        }

        $departures = $setup['departure'] === null ? [] : [(string) $setup['departure']->id];

        $result = $this->inventory->withLocks('departure', $departures, fn (): array => $this->tenantDb->run(
            $tenantId,
            fn (): array => $this->create($bookingId, $setup, $client, $ownerId, $actor, $origin),
            attempts: 3,
        ));

        if ($result['status'] === 'rechazada') {
            $this->tenantDb->run($tenantId, fn () => $this->reject($bookingId, $result['reason'], $actor));
        }

        return $result;
    }

    private function setup(string $bookingId): array
    {
        $booking = $this->booking($bookingId);
        $connection = DB::table('channel_ota_connections')->where('id', $booking->connection_id)->first(['id', 'code', 'ota', 'name', 'commission_pct']);
        $mapping = $booking->mapping_id === null ? null : DB::table('channel_ota_product_mappings')->where('id', $booking->mapping_id)->first(['id', 'product_id', 'status', 'price_mode', 'fixed_price']);
        $label = OtaChannel::OTAS[$connection->ota] ?? $connection->ota;

        if ($mapping === null || $mapping->status !== 'activo') {
            return ['reason' => 'El producto de la OTA no tiene un mapeo activo en el catálogo.'];
        }

        $pax = (int) ($booking->pax ?? 0);

        if ($booking->travel_date === null || $pax < 1) {
            throw ApiException::unprocessable('OTA_BOOKING_INCOMPLETE', "{$label} no envió la fecha de viaje o la cantidad de pasajeros.");
        }

        $currency = strtoupper(trim((string) $booking->currency));

        if (! in_array($currency, self::CURRENCIES, true)) {
            throw ApiException::unprocessable('OTA_CURRENCY', $currency === '' ? "{$label} no envió la moneda de la venta." : "La venta llegó en {$currency} y las reservas se registran en soles o dólares.");
        }

        $amounts = self::amounts($booking, $mapping, (string) $connection->commission_pct);

        if ($amounts['gross'] === null || ! $amounts['net']->isPositive()) {
            throw ApiException::unprocessable('OTA_BOOKING_INCOMPLETE', "{$label} no envió el importe de la venta.");
        }

        if ($amounts['commission']->isNegative()) {
            throw ApiException::unprocessable('SC-10', 'El neto que informa la OTA es mayor que el precio de venta.');
        }

        try {
            $product = $this->plans->product((string) $mapping->product_id);
        } catch (ApiException $error) {
            return ['reason' => $error->getMessage()];
        }

        $date = CarbonImmutable::parse((string) $booking->travel_date)->toDateString();

        if ($date < $this->plans->today()->toDateString()) {
            return ['reason' => 'La fecha de viaje ya pasó.'];
        }

        if ($product->maximum_passengers !== null && $pax > (int) $product->maximum_passengers) {
            return ['reason' => "«{$product->name}» admite hasta {$product->maximum_passengers} pasajeros por reserva."];
        }

        $departure = null;

        if ($product->availability_model === 'POR_SALIDA') {
            $departure = DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', $date)
                ->whereNotIn('status', ['cerrada', 'cancelada'])->orderBy('departure_time')->first(['id', 'ref']);

            if ($departure === null) {
                return ['reason' => 'No hay una salida abierta para esa fecha.'];
            }
        } else {
            $closed = DB::table('catalog_availability_ranges')->where('product_id', $product->id)->whereNull('deleted_at')
                ->where('date_from', '<=', $date)->where('date_to', '>=', $date)->where('status', '<>', 'disponible')->first(['status']);

            if ($closed !== null) {
                return ['reason' => $closed->status === 'agotado' ? 'El producto está agotado para esa fecha.' : 'El producto está cerrado para esa fecha.'];
            }
        }

        return [
            'reason' => null,
            'product' => $product,
            'departure' => $departure,
            'date' => $date,
            'pax' => $pax,
            'currency' => $currency,
            'amounts' => $amounts,
            'connection' => $connection,
            'label' => $label,
        ];
    }

    private function create(string $bookingId, array $setup, object $client, string $ownerId, User $actor, string $origin): array
    {
        $booking = DB::table('channel_ota_bookings')->where('id', $bookingId)->lock('for no key update')->first();

        if ($booking === null || $booking->status !== 'recibida') {
            return ['status' => (string) ($booking->status ?? 'error'), 'reason' => null];
        }

        $pax = $setup['pax'];
        $departure = $setup['departure'];

        if ($departure !== null) {
            $row = $this->inventory->lockRows('catalog_product_departures', [(string) $departure->id])[(string) $departure->id];
            $held = (int) DB::table('catalog_availability_holds')->where('departure_id', $departure->id)->where('status', 'hold')->where('expires_at', '>', now())->sum('quantity');
            $free = (int) $row->capacity - (int) $row->sold - $held;

            if ($free < $pax) {
                return ['status' => 'rechazada', 'reason' => $free > 0 ? "Solo quedan {$free} cupos en la salida {$departure->ref}." : "La salida {$departure->ref} ya no tiene cupos."];
            }
        }

        $product = $setup['product'];
        $currency = $setup['currency'];
        $amounts = $setup['amounts'];
        $net = $amounts['net'];
        $fx = $this->fx($currency);
        $label = $setup['label'];
        $ref = (string) $booking->ota_booking_ref;
        $days = $product->duration_unit === 'días' ? max(1, (int) ceil((float) $product->duration_value)) : 1;
        $until = CarbonImmutable::parse($setup['date'])->addDays($days - 1)->toDateString();
        $policies = (array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund', 'penalty_tiers']) ?? []);
        $version = DB::table('catalog_product_versions')->where('product_id', $product->id)->orderByDesc('created_at')->value('version');
        $terms = [
            'connection' => $setup['connection']->code,
            'ota' => $label,
            'booking_ref' => $ref,
            'gross_amount' => (string) $amounts['gross'],
            'commission_pct' => (string) $setup['connection']->commission_pct,
            'commission_amount' => (string) $amounts['commission'],
            'net_amount' => (string) $net,
        ];

        $reservation = new Reservation;
        $reservation->forceFill([
            'code' => $this->sequences->next('reservation'),
            'client_id' => $client->id,
            'owner_id' => $ownerId,
            'sede_id' => $this->assembler->sedeFor($ownerId, $actor),
            'title' => mb_substr("{$product->name} — {$client->name}", 0, 200),
            'status' => ReservationStatus::Confirmada->value,
            'channel' => self::CHANNEL,
            'travel_from' => $setup['date'],
            'travel_to' => $until,
            'currency' => $currency,
            'fx_rate' => $fx,
            'total_amount' => (string) $net,
            'snapshot_label' => mb_substr($product->code.($version ? " v{$version}" : '')." · {$label} {$ref}", 0, 300),
            'catalog_snapshot' => ['product' => $product->code, 'name' => $product->name, 'pax' => ['adt' => $pax, 'chd' => 0, 'inf' => 0], 'ota' => $terms],
            'policies_snapshot' => [$product->code => $policies],
            'notes' => "Reserva de {$label} {$ref}: la OTA vendió {$pax} pax a {$currency} {$amounts['gross']} y te paga el neto {$currency} {$net} (comisión {$currency} {$amounts['commission']}).",
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        if (! $this->states->isValidInitial(ReservationStatus::Confirmada->value)) {
            throw ApiException::conflict('STATE_TRANSITION_NOT_ALLOWED', 'El estado inicial de la reserva no es válido.');
        }

        $reservation->save();

        $item = (object) [
            'id' => null,
            'product_id' => $product->id,
            'qty' => 1,
            'pax' => $pax,
            'unit_price' => (string) $net->dividedBy($pax, 6, RoundingMode::HALF_UP),
            'unit_cost' => $this->unitCost((string) $product->id, $setup['date'], $currency, $fx),
            'service_date' => $setup['date'],
        ];
        $this->assembler->addServices($reservation, $item, $departure?->id, '0', $currency, $fx, $product->main_provider_id, 0, $actor, $departure !== null);
        $this->assembler->placeholders($reservation, $pax, 0, 0);
        $this->receivables->create($reservation, $actor, $net);
        $this->payables->handle((string) $reservation->id, $actor);

        DB::table('channel_ota_bookings')->where('id', $bookingId)->update(['status' => 'confirmada', 'reservation_id' => $reservation->id, 'error' => null, 'processed_at' => now(), 'updated_at' => now()]);

        $this->audit->log('Reserva', $reservation->code, 'crear_ota', null, "confirmada · {$label} {$ref} · {$currency} {$net} neto · {$pax} pax", actor: $actor);
        $this->audit->log('Reserva OTA', $setup['connection']->code.'/'.$ref, 'convertir', 'recibida', "confirmada · {$reservation->code} · {$origin}", actor: $actor);
        $this->publish($reservation, $actor);

        return ['status' => 'confirmada', 'reason' => null, 'reservation' => $reservation->code];
    }

    private function reject(string $bookingId, string $reason, User $actor): void
    {
        $booking = DB::table('channel_ota_bookings as b')->join('channel_ota_connections as c', 'c.id', '=', 'b.connection_id')
            ->where('b.id', $bookingId)->lock('for no key update')->first(['b.id', 'b.status', 'b.ota_booking_ref', 'c.code']);

        if ($booking === null || $booking->status !== 'recibida') {
            return;
        }

        DB::table('channel_ota_bookings')->where('id', $bookingId)->update(['status' => 'rechazada', 'error' => mb_substr($reason, 0, 500), 'processed_at' => now(), 'updated_at' => now()]);
        $this->audit->log('Reserva OTA', "{$booking->code}/{$booking->ota_booking_ref}", 'rechazar', 'recibida', mb_substr("rechazada · {$reason}", 0, 500), actor: $actor);
    }

    private function fail(string $bookingId, string $reason): void
    {
        $booking = DB::table('channel_ota_bookings as b')->join('channel_ota_connections as c', 'c.id', '=', 'b.connection_id')
            ->where('b.id', $bookingId)->lock('for no key update')->first(['b.id', 'b.status', 'b.ota_booking_ref', 'c.code']);

        if ($booking === null || $booking->status !== 'recibida') {
            return;
        }

        DB::table('channel_ota_bookings')->where('id', $bookingId)->update(['status' => 'error', 'error' => mb_substr($reason, 0, 500), 'processed_at' => now(), 'updated_at' => now()]);
        $this->audit->log('Reserva OTA', "{$booking->code}/{$booking->ota_booking_ref}", 'error', 'recibida', mb_substr("error · {$reason}", 0, 500));
    }

    private function note(string $bookingId, string $message): void
    {
        DB::table('channel_ota_bookings')->where('id', $bookingId)->where('status', 'recibida')->update(['error' => $message, 'updated_at' => now()]);
    }

    private function booking(string $bookingId): object
    {
        return (Str::isUuid($bookingId) ? DB::table('channel_ota_bookings')->where('id', $bookingId)->first() : null)
            ?? throw ApiException::notFound('La reserva de la OTA no existe.');
    }

    private function outcome(string $tenantId, string $bookingId): array
    {
        $row = $this->tenantDb->run($tenantId, fn (): ?object => DB::table('channel_ota_bookings as b')->leftJoin('booking_reservations as r', 'r.id', '=', 'b.reservation_id')
            ->where('b.id', $bookingId)->first(['b.id', 'b.ota_booking_ref', 'b.status', 'b.error', 'r.code as reservation_code']));

        return [
            'id' => (string) $row->id,
            'ota_booking_ref' => $row->ota_booking_ref,
            'status' => $row->status,
            'status_label' => OtaChannel::BOOKING_STATUSES[$row->status] ?? $row->status,
            'reservation' => $row->reservation_code,
            'error' => $row->error,
        ];
    }

    private function owner(string $bookingId): User
    {
        $connection = DB::table('channel_ota_bookings as b')->join('channel_ota_connections as c', 'c.id', '=', 'b.connection_id')->where('b.id', $bookingId)->first(['c.created_by', 'c.updated_by']);
        $active = fn ($query) => $query->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('u.client_id');
        $candidates = array_values(array_filter([$connection->created_by ?? null, $connection->updated_by ?? null]));
        $id = $candidates === [] ? null : DB::table('iam_users as u')->whereIn('u.id', $candidates)->where($active)->orderByRaw('u.id = ? desc', [$candidates[0]])->value('u.id');

        $id ??= DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where($active)->where('p.name', OtaChannel::PERMISSION)
            ->orderBy('u.code')->value('u.id');

        return ($id === null ? null : User::query()->find($id))
            ?? throw ApiException::conflict('OTA_OWNER', 'La agencia no tiene un responsable activo para recibir las reservas de la OTA.');
    }

    private function payloadClient(string $bookingId, User $owner, bool $create): ?object
    {
        $customer = self::customer($this->booking($bookingId));

        if ($customer === null) {
            return null;
        }

        $existing = $this->existingClient($customer);

        if ($existing !== null || ! $create || ! self::creatable($customer)) {
            return $existing;
        }

        $code = $this->codes->next('crm_clients', 'CLI-');
        $email = isset($customer['email']) ? Str::lower(trim((string) $customer['email'])) : null;
        $phone = isset($customer['phone']) ? trim((string) $customer['phone']) : null;
        $id = (string) DB::table('crm_clients')->insertGetId([
            'code' => $code,
            'kind' => 'persona',
            'name' => mb_substr(trim((string) $customer['name']), 0, 200),
            'doc_type' => strtoupper((string) $customer['doc_type']),
            'doc_number' => Str::upper((string) preg_replace('/\s+/', '', (string) $customer['doc_number'])),
            'email' => $email ?: null,
            'phone' => $phone ?: null,
            'phone_norm' => substr((string) preg_replace('/\D/', '', (string) $phone), -9) ?: null,
            'country' => mb_substr(trim((string) ($customer['country'] ?? '')) ?: 'Perú', 0, 80),
            'segment_code' => 'Retail',
            'owner_id' => $owner->getKey(),
            'tags' => '{OTA}',
            'created_by' => $owner->getKey(),
            'updated_by' => $owner->getKey(),
        ]);
        $this->audit->log('Cliente', $code, 'crear_desde_ota', after: mb_substr(trim((string) $customer['name']).' · Retail', 0, 200), actor: $owner);

        return (object) ['id' => $id, 'code' => $code, 'name' => trim((string) $customer['name'])];
    }

    private function existingClient(array $customer): ?object
    {
        $email = Str::lower(trim((string) ($customer['email'] ?? '')));
        $document = Str::upper((string) preg_replace('/\s+/', '', (string) ($customer['doc_number'] ?? '')));
        $type = strtoupper((string) ($customer['doc_type'] ?? ''));

        if ($document !== '' && in_array($type, self::CLIENT_DOC_TYPES, true)) {
            $match = DB::table('crm_clients')->whereNull('deleted_at')->where('doc_type', $type)->where('doc_number', $document)->first(['id', 'code', 'name']);

            if ($match !== null) {
                return $match;
            }
        }

        return $email === '' ? null : DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->orderBy('code')->first(['id', 'code', 'name']);
    }

    private static function customer(object $booking): ?array
    {
        $payload = json_decode((string) $booking->payload, true);
        $customer = is_array($payload) ? ($payload['booking']['customer'] ?? null) : null;

        return is_array($customer) && $customer !== [] ? $customer : null;
    }

    private static function creatable(array $customer): bool
    {
        return trim((string) ($customer['name'] ?? '')) !== ''
            && in_array(strtoupper((string) ($customer['doc_type'] ?? '')), self::CLIENT_DOC_TYPES, true)
            && trim((string) ($customer['doc_number'] ?? '')) !== ''
            && (trim((string) ($customer['email'] ?? '')) !== '' || trim((string) ($customer['phone'] ?? '')) !== '');
    }

    private function unitCost(string $productId, string $date, string $currency, string $fx): string
    {
        $rate = RateResolver::pick(DB::table('catalog_rates')->where('product_id', $productId)->get(['segment', 'channel', 'rate_type', 'status', 'valid_from', 'valid_to', 'price', 'cost', 'currency']), $date, ['Adulto', 'Pasajero'], self::CHANNEL);

        if (! is_object($rate)) {
            return '0';
        }

        return (string) Decimal::convert((string) ($rate->cost ?? '0'), trim((string) $rate->currency), $currency, $fx);
    }

    private function fx(string $currency): string
    {
        if ($currency === 'PEN') {
            return '1';
        }

        $rate = DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen')
            ?? throw ApiException::unprocessable('FX_MISSING', "No hay tipo de cambio registrado para {$currency}.");

        return (string) BigDecimal::of((string) $rate)->toScale(6, RoundingMode::HALF_UP);
    }

    private function asTeam(string $tenantId): void
    {
        $registrar = app(PermissionRegistrar::class);
        $key = config('permission.cache.key').'.'.$tenantId;

        if ($registrar->cacheKey !== $key) {
            $registrar->cacheKey = $key;
            $registrar->clearPermissionsCollection();
        }

        $registrar->setPermissionsTeamId($tenantId);
    }

    private function publish(Reservation $reservation, User $actor): void
    {
        $id = (string) $reservation->getKey();
        $tenantId = $this->context->idOrFail();
        $payload = ['reservation_id' => $id, 'reservation_code' => $reservation->code, 'origin' => 'ota'];
        $this->outbox->add('booking_reservation', $id, 'ReservationCreated', $payload);
        $this->outbox->add('booking_reservation', $id, 'ReservationConfirmed', $payload);
        ReservationCreated::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());
        ReservationConfirmed::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());
    }
}
