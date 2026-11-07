<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class ReservationServiceRequests
{
    public function __construct(
        private readonly ReservationLifecycle $lifecycle,
        private readonly ProviderServiceResponse $responses,
        private readonly AuditLogger $audit,
        private readonly QueuedMail $mail,
        private readonly TenantContext $context,
    ) {}

    public function request(string $code, string $serviceCode, ?string $note, User $actor): object
    {
        return DB::transaction(function () use ($code, $serviceCode, $note, $actor): object {
            $reservation = $this->lifecycle->open($code, $actor);
            $service = $this->service($reservation, $serviceCode);

            if ($service->status !== 'pendiente') {
                throw ApiException::conflict('STATE_TRANSITION_NOT_ALLOWED', 'Solo se solicita un servicio pendiente. Este está '.str_replace('_', ' ', (string) $service->status).'.');
            }

            $provider = $this->provider($service);
            $this->send($reservation, $service, $provider, $note, $actor);

            return $this->fresh($service->id);
        });
    }

    public function requestPending(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $reservation = $this->lifecycle->open($code, $actor);
            $pending = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('status', 'pendiente')
                ->orderBy('service_date')->orderBy('code')->lockForUpdate()->get();
            $requested = [];
            $skipped = [];

            foreach ($pending as $service) {
                try {
                    $provider = $this->provider($service);
                } catch (ApiException $e) {
                    $skipped[] = ['code' => $service->code, 'name' => $service->name, 'reason' => $e->getMessage()];

                    continue;
                }

                $this->send($reservation, $service, $provider, null, $actor);
                $requested[] = $service->code;
            }

            return ['requested' => $requested, 'skipped' => $skipped];
        });
    }

    public function confirm(string $code, string $serviceCode, array $data, User $actor): object
    {
        return DB::transaction(function () use ($code, $serviceCode, $data, $actor): object {
            $reservation = $this->lifecycle->open($code, $actor);
            $service = $this->service($reservation, $serviceCode);
            $result = $this->responses->confirm($service->id, [
                'confirmation_code' => $data['confirmation_code'],
                'confirmed_by_name' => $data['confirmed_by'] ?? null,
                'service_time' => $data['time'] ?? null,
                'note' => $data['note'] ?? null,
            ], $actor, 'web_interno');
            $this->audit->log('Servicio reserva', $service->code, 'confirmar', $service->status, "confirmado {$result->code}", actor: $actor);

            return $this->fresh($service->id);
        });
    }

    public function reject(string $code, string $serviceCode, array $data, User $actor): object
    {
        return DB::transaction(function () use ($code, $serviceCode, $data, $actor): object {
            $reservation = $this->lifecycle->open($code, $actor);
            $service = $this->service($reservation, $serviceCode);
            $result = $this->responses->reject($service->id, [
                'reason' => $data['reason'],
                'note' => $data['detail'],
                'alt_date' => $data['alternative_date'] ?? null,
            ], $actor, 'web_interno');
            $after = "rechazado: {$data['reason']}".($result->alternative ? " · alternativa {$result->alternative->date} ({$result->alternative->code})" : '');
            $this->audit->log('Servicio reserva', $service->code, 'rechazar', $service->status, $after, actor: $actor);

            return (object) [...(array) $this->fresh($service->id), 'alternative' => $result->alternative?->code];
        });
    }

    private function service(Reservation $reservation, string $serviceCode): object
    {
        return DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)
            ->where(fn ($query) => preg_match('/^[0-9a-f-]{36}$/i', $serviceCode) === 1 ? $query->where('id', $serviceCode) : $query->where('code', $serviceCode))
            ->lockForUpdate()->first() ?? throw ApiException::notFound('El servicio no existe en esta reserva.');
    }

    private function provider(object $service): object
    {
        $provider = $service->provider_id ? DB::table('catalog_providers')->where('id', $service->provider_id)->first(['id', 'name', 'email', 'contact_name', 'status']) : null;

        if ($provider === null) {
            throw ApiException::unprocessable('RES-BR-11', 'El servicio no tiene proveedor asignado.');
        }

        if ($provider->status !== 'activo') {
            throw ApiException::conflict('RES-BR-11', "El proveedor {$provider->name} no está activo.");
        }

        return $provider;
    }

    private function send(Reservation $reservation, object $service, object $provider, ?string $note, User $actor): void
    {
        DB::table('booking_reservation_services')->where('id', $service->id)->update([
            'status' => 'solicitado',
            'requested_at' => now(),
            'requested_by' => $actor->getKey(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        DB::table('ops_supplier_requests')->insert([
            'reservation_service_id' => $service->id,
            'provider_id' => $provider->id,
            'status' => 'solicitado',
            'channel' => $provider->email ? 'email' : 'telefono',
            'requested_at' => now(),
            'requested_by' => $actor->getKey(),
            'note' => $note,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        if ($provider->email) {
            $agency = $this->context->tenant()->commercial_name;
            $date = CarbonImmutable::parse($service->service_date)->format('d/m/Y');
            $time = $service->service_time ? ' a las '.substr((string) $service->service_time, 0, 5) : '';
            $body = "Hola, {$provider->contact_name}:\n\nTe pedimos confirmar el servicio «{$service->name}» para el {$date}{$time}, {$service->pax} pasajeros.\n"
                .($note ? "\n{$note}\n" : '')
                ."\nResponde desde la extranet de proveedores con el código de confirmación.\n\nServicio {$service->code} · Reserva {$reservation->code}\n{$agency}";
            $this->mail->send((string) $provider->email, $provider->contact_name, "Solicitud de servicio {$service->code} · {$agency}", $body);
        }

        $this->audit->log('Servicio reserva', $service->code, 'solicitar', $service->status, "solicitado a {$provider->name}", actor: $actor);
    }

    private function fresh(string $serviceId): object
    {
        return DB::table('booking_reservation_services')->where('id', $serviceId)
            ->first(['id', 'code', 'name', 'service_date', 'service_time', 'status', 'confirmation_code', 'reject_reason', 'requested_at', 'confirmed_at']);
    }
}
