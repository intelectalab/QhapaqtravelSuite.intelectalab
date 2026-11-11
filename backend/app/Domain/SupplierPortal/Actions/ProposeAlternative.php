<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Facades\DB;

final class ProposeAlternative
{
    public const KINDS = ['Otra fecha', 'Otro tipo de habitación', 'Otro horario', 'Upgrade sin costo', 'Otro'];

    public function __construct(private readonly AuditLogger $audit, private readonly OpsNotices $notices) {}

    public function handle(SupplierAccount $account, string $code, array $data): string
    {
        return DB::transaction(function () use ($account, $code, $data): string {
            $service = $account->service($code);
            DB::table('booking_reservation_services')->where('id', $service->id)->lock('for no key update')->value('id');

            if (! in_array($service->status, ProviderServiceResponse::OPEN, true) || in_array($service->reservation_status, ['borrador', 'cancelada', 'completada'], true)) {
                throw ApiException::conflict('SUP-BR-04', 'La solicitud ya fue respondida ('.str_replace('_', ' ', (string) $service->status).'). Para cambios contacte a Operaciones.');
            }

            if (DB::table('supplier_request_responses')->where('reservation_service_id', $service->id)->where('type', 'alternativa')->where('review_status', 'pendiente')->exists()) {
                throw ApiException::conflict('SUP-BR-04', 'Ya propuso una alternativa para esta solicitud. Espere la respuesta de Operaciones.');
            }

            if ($data['alt_kind'] === 'Otra fecha' && empty($data['alt_date'])) {
                throw ApiException::unprocessable('SUP-BR-08', 'Indique la fecha que propone.');
            }

            if (! empty($data['alt_date']) && $data['alt_date'] === $service->service_date) {
                throw ApiException::unprocessable('SUP-BR-08', 'La fecha propuesta debe ser distinta a la solicitada.');
            }

            $alternativeService = null;
            if (! empty($data['alt_service'])) {
                $alternativeService = $account->catalogService((string) $data['alt_service']);

                if ($alternativeService->status !== 'activo') {
                    throw ApiException::unprocessable('SUP-BR-08', 'El servicio alternativo debe ser un servicio activo de su empresa.');
                }
            }

            $request = DB::table('ops_supplier_requests')->where('reservation_service_id', $service->id)->whereNull('deleted_at')->where('status', 'solicitado')->orderByDesc('requested_at')->value('id')
                ?? DB::table('ops_supplier_requests')->insertGetId([
                    'reservation_service_id' => $service->id,
                    'provider_id' => $service->provider_id,
                    'status' => 'solicitado',
                    'channel' => 'extranet',
                    'requested_at' => $service->requested_at ?? now(),
                    'requested_by' => $service->requested_by ?? DB::table('booking_reservations')->where('id', $service->reservation_id)->value('owner_id') ?? $account->user->getKey(),
                    'created_by' => $account->user->getKey(),
                    'updated_by' => $account->user->getKey(),
                ], 'id');

            $id = (string) DB::table('supplier_request_responses')->insertGetId([
                'supplier_request_id' => $request,
                'reservation_service_id' => $service->id,
                'provider_id' => $account->id(),
                'type' => 'alternativa',
                'responded_by_user_id' => $account->user->getKey(),
                'responded_at' => now(),
                'alt_kind' => $data['alt_kind'],
                'alt_date' => $data['alt_date'] ?? null,
                'alt_service_id' => $alternativeService?->id,
                'alt_net_cost' => $data['alt_net_cost'] ?? null,
                'currency' => $service->currency,
                'hold_until' => $data['hold_until'] ?? null,
                'note' => trim((string) $data['note']),
                'review_status' => 'pendiente',
                'created_by' => $account->user->getKey(),
                'updated_by' => $account->user->getKey(),
            ], 'id');

            $summary = self::summary($data['alt_kind'], $data['alt_date'] ?? null, isset($data['alt_net_cost']) ? (float) $data['alt_net_cost'] : null, (string) $service->currency);
            $this->audit->log('Servicio reserva', $service->code, 'proveedor_alternativa', $service->status, $summary);
            $this->notices->toOperations('proveedor.alternativa', "{$account->provider->name} propuso una alternativa para {$service->code}", "{$summary}. {$data['note']}", 'supplier_request_response', $id, (string) $service->reservation_id);

            return $id;
        });
    }

    public static function summary(string $kind, ?string $date, ?float $cost, string $currency): string
    {
        return implode(' · ', array_filter([$kind, $date, $cost !== null ? $currency.' '.number_format($cost, 2, '.', '') : null]));
    }
}
