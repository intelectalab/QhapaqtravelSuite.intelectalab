<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ServiceDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ServiceRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $values = $this->values($data);
            $providerActive = $this->providerActive($values['provider_id']);
            $ref = $this->codes->next('catalog_services', 'SRV-', 3, 'ref');
            DB::table('catalog_services')->insert([...$values, 'ref' => $ref, 'status' => $providerActive ? 'activo' : 'inactivo', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Servicio', $ref, 'crear', after: "{$values['name']} · {$values['currency']} {$values['cost']} por {$values['unit']}");

            return ['ref' => $ref, 'warning' => $providerActive ? null : 'El proveedor no está activo: el servicio se guardó inactivo.'];
        });
    }

    public function update(string $ref, array $data, User $actor): array
    {
        return DB::transaction(function () use ($ref, $data, $actor): array {
            $service = $this->service($ref);
            $values = $this->values($data);
            $providerActive = $this->providerActive($values['provider_id']);
            $status = $providerActive ? $service->status : 'inactivo';
            DB::table('catalog_services')->where('id', $service->id)->update([...$values, 'status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ((float) $service->cost !== $values['cost'] || trim($service->currency) !== $values['currency']) {
                $uses = DB::table('catalog_product_items')->where('service_id', $service->id)->distinct()->count('product_id');
                $this->audit->log('Servicio', $ref, 'cambio_costo', trim($service->currency)." {$service->cost}", "{$values['currency']} {$values['cost']} · usado en {$uses} productos");
            } else {
                $this->audit->log('Servicio', $ref, 'modificar', after: $values['name']);
            }

            return ['ref' => $ref, 'warning' => $providerActive ? null : 'El proveedor no está activo: el servicio quedó inactivo.'];
        });
    }

    public function setActive(string $ref, bool $active, ?string $reason, User $actor): void
    {
        DB::transaction(function () use ($ref, $active, $reason, $actor): void {
            $service = $this->service($ref);

            if ($active && ! $this->providerActive($service->provider_id)) {
                throw ApiException::conflict('PRD-BR-007', 'El proveedor no está activo o su contrato venció.');
            }

            if ($active && $service->valid_to < CatalogAccess::today()) {
                throw ApiException::conflict('PRD-BR-003', 'La vigencia del servicio terminó. Extiéndela antes de activarlo.');
            }

            DB::table('catalog_services')->where('id', $service->id)->update(['status' => $active ? 'activo' : 'inactivo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Servicio', $ref, $active ? 'activar' : 'desactivar', $service->status, trim(($active ? 'activo' : 'inactivo').($reason ? " · {$reason}" : '')));
        });
    }

    private function service(string $ref): object
    {
        return DB::table('catalog_services')->where('ref', $ref)->whereNull('deleted_at')->lock('for no key update')->first() ?? throw ApiException::notFound('El servicio no existe.');
    }

    private function providerActive(string $providerId): bool
    {
        $provider = DB::table('catalog_providers')->where('id', $providerId)->whereNull('deleted_at')->first(['status', 'contract_end'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un proveedor del catálogo.');

        return ServiceDirectory::providerState($provider, CatalogAccess::today()) === 'activo';
    }

    private function values(array $data): array
    {
        return [
            'provider_id' => $data['provider_id'],
            'name' => trim($data['name']),
            'type' => $data['type'],
            'unit' => $data['unit'],
            'cost' => round((float) $data['cost'], 2),
            'currency' => $data['currency'],
            'capacity' => isset($data['capacity']) ? (int) $data['capacity'] : null,
            'valid_from' => $data['valid_from'],
            'valid_to' => $data['valid_to'],
        ];
    }
}
