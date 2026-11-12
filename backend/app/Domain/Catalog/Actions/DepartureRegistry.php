<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\DepartureDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class DepartureRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $product = DB::table('catalog_products')->where('id', $data['product_id'])->whereNull('deleted_at')->first(['id', 'code', 'status'])
                ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un producto del catálogo.');

            if (in_array($product->status, ['INACTIVE', 'ARCHIVED'], true)) {
                throw ApiException::unprocessable('CAT-BR-20', 'El producto está inactivo o archivado: no admite salidas nuevas.');
            }

            if ($data['departure_date'] < CatalogAccess::today()) {
                throw ApiException::unprocessable('CAT-BR-20', 'La fecha de salida debe ser hoy o después.');
            }

            $values = $this->values($data);
            $this->guardResources($values);
            $ref = $this->codes->next('catalog_product_departures', 'SAL-', 4, 'ref');
            DB::table('catalog_product_departures')->insert([...$values, 'ref' => $ref, 'product_id' => $product->id, 'sold' => 0, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Salida', $ref, 'crear', after: "{$product->code} · {$values['departure_date']} {$values['departure_time']} · {$values['capacity']} cupos · {$values['status']}");

            return ['ref' => $ref, 'warning' => $this->vehicleWarning($values)];
        });
    }

    public function update(string $ref, array $data, int $version, User $actor): array
    {
        return DB::transaction(function () use ($ref, $data, $version, $actor): array {
            $departure = $this->departure($ref);
            $values = $this->values($data);
            $held = DepartureDirectory::held($departure->id);

            if ($values['departure_date'] !== $departure->departure_date && $values['departure_date'] < CatalogAccess::today()) {
                throw ApiException::unprocessable('CAT-BR-20', 'La nueva fecha debe ser hoy o después.');
            }

            if ($values['capacity'] < $departure->sold + $held) {
                throw ApiException::unprocessable('CAT-BR-20', "La capacidad no puede ser menor que lo vendido y retenido ({$departure->sold} vendidos y {$held} en hold).");
            }

            $this->guardResources($values);

            if ($values['status'] === 'abierta' && $departure->sold >= $values['capacity']) {
                $values['status'] = 'completa';
            }

            $updated = DB::table('catalog_product_departures')->where('id', $departure->id)->where('lock_version', $version)
                ->update([...$values, 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta salida mientras la veías. Recarga la página e inténtalo de nuevo.');
            }

            $this->audit->log('Salida', $ref, 'modificar', "{$departure->departure_date} · {$departure->capacity} cupos · {$departure->status}", "{$values['departure_date']} · {$values['capacity']} cupos · {$values['status']}");

            return ['ref' => $ref, 'warning' => $this->cancelWarning($departure, $values['status']) ?? $this->vehicleWarning($values)];
        });
    }

    public function changeStatus(string $ref, string $status, string $reason, User $actor): array
    {
        return DB::transaction(function () use ($ref, $status, $reason, $actor): array {
            $departure = $this->departure($ref);

            if ($departure->status === $status) {
                return ['ref' => $ref, 'warning' => null];
            }

            if ($departure->status === 'cancelada') {
                throw ApiException::conflict('CAT-BR-20', 'La salida ya está cancelada. Edítala si necesitas reabrirla.');
            }

            DB::table('catalog_product_departures')->where('id', $departure->id)->update([
                'status' => $status,
                'notes' => trim(($departure->notes ? "{$departure->notes}\n" : '').($status === 'cancelada' ? 'Cancelada' : 'Cerrada').": {$reason}"),
                'lock_version' => $departure->lock_version + 1,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Salida', $ref, $status === 'cancelada' ? 'cancelar' : 'cerrar', $departure->status, "{$status} · {$reason}");

            if ($status === 'cancelada' && (int) $departure->sold > 0) {
                app(StaffNotices::class)->toRoles(['operations', 'manager'], 'salida.cancelada', "Salida {$ref} cancelada con {$departure->sold} vendidos", "Reubica o reembolsa a los pasajeros. Motivo: {$reason}", 'catalog_departure', (string) $departure->id, null, [], (string) $actor->getKey());
            }

            return ['ref' => $ref, 'warning' => $this->cancelWarning($departure, $status)];
        });
    }

    private function departure(string $ref): object
    {
        return DB::table('catalog_product_departures')->where('ref', $ref)->lock('for no key update')->first() ?? throw ApiException::notFound('La salida no existe.');
    }

    private function values(array $data): array
    {
        return [
            'departure_date' => $data['departure_date'],
            'departure_time' => $data['departure_time'],
            'capacity' => (int) $data['capacity'],
            'status' => $data['status'] ?? 'abierta',
            'provider_id' => $data['provider_id'] ?? null,
            'guide_id' => $data['guide_id'] ?? null,
            'vehicle_id' => $data['vehicle_id'] ?? null,
            'meeting_point' => trim($data['meeting_point']),
            'return_point' => $data['return_point'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];
    }

    private function guardResources(array $values): void
    {
        if ($values['provider_id'] && ! DB::table('catalog_providers')->where('id', $values['provider_id'])->whereNull('deleted_at')->where('status', 'activo')->exists()) {
            throw ApiException::unprocessable('PRD-BR-007', 'El proveedor no está activo.');
        }

        if ($values['guide_id'] && ! DB::table('ops_guides')->where('id', $values['guide_id'])->whereNull('deleted_at')->where('status', '<>', 'vacaciones')->exists()) {
            throw ApiException::unprocessable('CAT-BR-20', 'El guía está de vacaciones o no existe.');
        }

        if ($values['vehicle_id'] && ! DB::table('ops_vehicles')->where('id', $values['vehicle_id'])->whereNull('deleted_at')->where('status', '<>', 'mantenimiento')->exists()) {
            throw ApiException::unprocessable('CAT-BR-20', 'El vehículo está en mantenimiento o no existe.');
        }
    }

    private function vehicleWarning(array $values): ?string
    {
        $seats = $values['vehicle_id'] ? (int) DB::table('ops_vehicles')->where('id', $values['vehicle_id'])->value('capacity') : null;

        return $seats !== null && $seats < $values['capacity'] ? "El vehículo tiene {$seats} asientos y la salida {$values['capacity']} cupos." : null;
    }

    private function cancelWarning(object $departure, string $status): ?string
    {
        return $status === 'cancelada' && $departure->sold > 0 ? "Hay {$departure->sold} pasajeros vendidos: coordina con Operaciones para reprogramarlos." : null;
    }
}
