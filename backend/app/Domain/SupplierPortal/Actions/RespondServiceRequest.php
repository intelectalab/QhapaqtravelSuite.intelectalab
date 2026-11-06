<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Facades\DB;

final class RespondServiceRequest
{
    public function __construct(private readonly ProviderServiceResponse $responses, private readonly AuditLogger $audit) {}

    public function confirm(SupplierAccount $account, string $code, array $data): void
    {
        DB::transaction(function () use ($account, $code, $data): void {
            $service = $account->service($code);
            $data['confirmed_by_name'] = trim((string) ($data['confirmed_by_name'] ?? '')) ?: $account->provider->contact_name;
            $result = $this->responses->confirm($service->id, $data, $account->user, 'extranet');
            $this->record($account, $service, $result->request_id, [
                'type' => 'confirmacion',
                'confirmed_by_name' => $data['confirmed_by_name'],
                'confirmation_code' => $result->code,
                'note' => $data['note'] ?? null,
            ]);
            $this->audit->log('Servicio reserva', $service->code, 'proveedor_confirma', $service->status, "confirmado {$result->code}");
        });
    }

    public function reject(SupplierAccount $account, string $code, array $data): ?string
    {
        return DB::transaction(function () use ($account, $code, $data): ?string {
            $service = $account->service($code);
            $result = $this->responses->reject($service->id, $data, $account->user, 'extranet');
            $this->record($account, $service, $result->request_id, [
                'type' => 'rechazo',
                'rejection_reason' => $data['reason'],
                'alt_kind' => $result->alternative ? 'Otra fecha' : null,
                'alt_date' => $result->alternative?->date,
                'note' => trim((string) $data['note']),
            ]);
            $after = "rechazado: {$data['reason']}".($result->alternative ? " · alternativa {$result->alternative->date} ({$result->alternative->code})" : '');
            $this->audit->log('Servicio reserva', $service->code, 'proveedor_rechaza', $service->status, $after);

            return $result->alternative?->code;
        });
    }

    private function record(SupplierAccount $account, object $service, string $requestId, array $values): void
    {
        DB::table('supplier_request_responses')->insert([
            'supplier_request_id' => $requestId,
            'reservation_service_id' => $service->id,
            'provider_id' => $account->id(),
            'responded_by_user_id' => $account->user->getKey(),
            'responded_at' => now(),
            'currency' => $service->currency,
            'created_by' => $account->user->getKey(),
            'updated_by' => $account->user->getKey(),
            ...$values,
        ]);
    }
}
