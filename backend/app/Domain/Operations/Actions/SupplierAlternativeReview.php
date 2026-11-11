<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\SupplierPortal\Actions\ProposeAlternative;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierAlternativeReview
{
    public function __construct(private readonly ProviderServiceResponse $responses, private readonly AuditLogger $audit, private readonly OpsNotices $notices) {}

    public function accept(string $id, array $data, User $actor): array
    {
        return DB::transaction(function () use ($id, $data, $actor): array {
            [$response, $service] = $this->lockPending($id);
            $changes = ['lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()];
            $dateChanged = $response->alt_date !== null && $response->alt_date !== $service->service_date;

            if ($dateChanged) {
                $changes['service_date'] = $response->alt_date;
            }

            if ($response->alt_service_id !== null) {
                $catalog = DB::table('catalog_services')->where('id', $response->alt_service_id)->first(['id', 'name']);
                $changes['catalog_service_id'] = $response->alt_service_id;
                $changes['name'] = $catalog->name ?? $service->name;
            }

            if ($response->alt_net_cost !== null) {
                $changes['cost_amount'] = $response->alt_net_cost;
            }

            $code = Str::upper(trim((string) ($data['confirmation_code'] ?? '')));
            if ($code === '') {
                $changes['status'] = 'solicitado';
                $changes['requested_at'] = now();
                $changes['requested_by'] = $actor->getKey();
            }

            DB::table('booking_reservation_services')->where('id', $service->id)->update($changes);

            $released = 0;
            if ($dateChanged) {
                $released = DB::table('ops_assignments')->where('reservation_service_id', $service->id)->whereNotIn('status', ['completada', 'en_curso'])
                    ->update(['service_date' => $response->alt_date, 'status' => 'pendiente', 'guide_id' => null, 'driver_id' => null, 'vehicle_id' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            }

            if ($code !== '') {
                $contact = DB::table('catalog_providers')->where('id', $service->provider_id)->value('contact_name');
                $this->responses->confirm((string) $service->id, ['confirmation_code' => $code, 'confirmed_by_name' => $contact, 'note' => $data['note'] ?? null], $actor, 'web_interno');
            } else {
                DB::table('ops_supplier_requests')->where('reservation_service_id', $service->id)->whereNull('deleted_at')->where('status', 'solicitado')->update(['requested_at' => now(), 'requested_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $this->close($response, 'aceptada', $data['note'] ?? null, $actor);
            $summary = ProposeAlternative::summary((string) $response->alt_kind, $response->alt_date, $response->alt_net_cost === null ? null : (float) $response->alt_net_cost, (string) $response->currency);
            $this->audit->log('Servicio reserva', $service->code, 'aceptar_alternativa', $service->status, ($code !== '' ? "confirmado {$code}" : 'solicitado').' · '.$summary);
            $this->notifyProvider($service, 'proveedor.alternativa_aceptada', "La agencia aceptó su alternativa para {$service->code}", $code !== '' ? "Quedó confirmada con el código {$code}." : 'La agencia le reenvía la solicitud con los nuevos datos. Confírmela con su código.', $response->id);

            return ['service' => $service->code, 'status' => $code !== '' ? 'confirmado' : 'solicitado', 'released_assignments' => $released];
        });
    }

    public function reject(string $id, array $data, User $actor): array
    {
        return DB::transaction(function () use ($id, $data, $actor): array {
            [$response, $service] = $this->lockPending($id);
            $this->close($response, 'rechazada', $data['note'], $actor);
            $this->audit->log('Servicio reserva', $service->code, 'rechazar_alternativa', (string) $response->alt_kind, $data['note']);
            $this->notifyProvider($service, 'proveedor.alternativa_rechazada', "La agencia no aceptó su alternativa para {$service->code}", "Motivo: {$data['note']}. La solicitud original sigue por responder.", $response->id);

            return ['service' => $service->code, 'status' => $service->status];
        });
    }

    private function lockPending(string $id): array
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La respuesta del proveedor no existe.');
        }

        $response = DB::table('supplier_request_responses')->where('id', $id)->lock('for no key update')->first() ?? throw ApiException::notFound('La respuesta del proveedor no existe.');

        if ($response->type !== 'alternativa' || $response->review_status !== 'pendiente') {
            throw ApiException::conflict('SUP-BR-08', 'Esta alternativa ya fue revisada ('.($response->review_status ?? 'sin revisión').').');
        }

        $service = DB::table('booking_reservation_services')->where('id', $response->reservation_service_id)->lock('for no key update')->first() ?? throw ApiException::notFound();

        if (! in_array($service->status, ProviderServiceResponse::OPEN, true)) {
            throw ApiException::conflict('SUP-BR-04', 'El servicio ya no espera respuesta del proveedor ('.str_replace('_', ' ', (string) $service->status).').');
        }

        return [$response, $service];
    }

    private function close(object $response, string $status, ?string $note, User $actor): void
    {
        DB::table('supplier_request_responses')->where('id', $response->id)->update([
            'review_status' => $status,
            'reviewed_by' => $actor->getKey(),
            'reviewed_at' => now(),
            'review_note' => $note !== null && trim($note) !== '' ? trim($note) : null,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
    }

    private function notifyProvider(object $service, string $event, string $subject, string $body, string $responseId): void
    {
        $users = DB::table('iam_users')->where('provider_id', $service->provider_id)->whereNull('deleted_at')->where('status', 'activo')->pluck('id');
        $this->notices->toUsers($users, $event, $subject, $body, 'supplier_request_response', $responseId, (string) $service->reservation_id);
    }
}
