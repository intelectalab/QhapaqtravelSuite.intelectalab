<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ProviderRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $values = $this->values($data);
            $this->assertUniqueRuc($values['ruc'], null);
            $ref = $this->codes->next('catalog_providers', 'PRV-', 3, 'ref');
            $id = (string) DB::table('catalog_providers')->insertGetId([...$values, 'ref' => $ref, 'status' => 'inactivo', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            DB::table('catalog_provider_contacts')->insert(['provider_id' => $id, 'name' => $values['contact_name'], 'role' => 'Contacto comercial', 'phone' => $values['phone'], 'email' => $values['email'], 'created_by' => $actor->getKey()]);
            $this->audit->log('Proveedor', $ref, 'crear', after: "{$values['name']} · RUC {$values['ruc']}");

            return $ref;
        });
    }

    public function update(string $ref, array $data, User $actor): string
    {
        return DB::transaction(function () use ($ref, $data, $actor): string {
            $provider = $this->provider($ref);
            $values = $this->values($data);
            $this->assertUniqueRuc($values['ruc'], $provider->id);
            $status = $provider->status === 'vencido' && $values['contract_end'] >= CatalogAccess::today() ? 'inactivo' : $provider->status;
            DB::table('catalog_providers')->where('id', $provider->id)->update([...$values, 'status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Proveedor', $ref, 'modificar', "{$provider->name} · contrato hasta {$provider->contract_end}", "{$values['name']} · contrato hasta {$values['contract_end']}");

            return $ref;
        });
    }

    public function setActive(string $ref, bool $active, ?string $reason, User $actor): array
    {
        return DB::transaction(function () use ($ref, $active, $reason, $actor): array {
            $provider = $this->provider($ref);

            if ($active && $provider->contract_end < CatalogAccess::today()) {
                throw ApiException::conflict('CAT-BR-38', 'El contrato está vencido. Renuévalo antes de activar al proveedor.');
            }

            DB::table('catalog_providers')->where('id', $provider->id)->update(['status' => $active ? 'activo' : 'inactivo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Proveedor', $ref, $active ? 'activar' : 'desactivar', $provider->status, trim(($active ? 'activo' : 'inactivo').($reason ? " · {$reason}" : '')));
            $affected = $active ? 0 : DB::table('catalog_products')->where('main_provider_id', $provider->id)->where('status', 'ACTIVE')->whereNull('deleted_at')->count();

            return ['ref' => $ref, 'warning' => $affected > 0 ? "{$affected} productos activos usan a este proveedor como principal." : null];
        });
    }

    public function addContact(string $ref, array $data, User $actor): void
    {
        $provider = $this->provider($ref);
        DB::table('catalog_provider_contacts')->insert(['provider_id' => $provider->id, 'name' => trim($data['name']), 'role' => $data['role'] ?? null, 'phone' => $data['phone'] ?? null, 'email' => $data['email'] ?? null, 'created_by' => $actor->getKey()]);
        $this->audit->log('Proveedor', $ref, 'agregar_contacto', after: $data['name']);
    }

    public function removeContact(string $ref, string $contactId): void
    {
        $provider = $this->provider($ref);
        $contact = DB::table('catalog_provider_contacts')->where('provider_id', $provider->id)->where('id', $contactId)->first(['id', 'name']) ?? throw ApiException::notFound('El contacto no existe.');
        DB::table('catalog_provider_contacts')->where('id', $contact->id)->delete();
        $this->audit->log('Proveedor', $ref, 'quitar_contacto', $contact->name);
    }

    private function provider(string $ref): object
    {
        return DB::table('catalog_providers')->where('ref', $ref)->whereNull('deleted_at')->lock('for no key update')->first() ?? throw ApiException::notFound('El proveedor no existe.');
    }

    private function assertUniqueRuc(string $ruc, ?string $exceptId): void
    {
        $taken = DB::table('catalog_providers')->where('ruc', $ruc)->when($exceptId, fn ($query) => $query->where('id', '<>', $exceptId))->value('name');

        if ($taken) {
            throw ApiException::unprocessable('CAT-BR-38', "El RUC ya está registrado para {$taken}.");
        }
    }

    private function values(array $data): array
    {
        return [
            'name' => trim($data['name']),
            'type' => $data['type'],
            'ruc' => $data['ruc'],
            'city' => $data['city'] ?? null,
            'stars' => isset($data['stars']) ? (int) $data['stars'] : null,
            'contact_name' => trim($data['contact_name']),
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'contract_start' => $data['contract_start'],
            'contract_end' => $data['contract_end'],
            'currency' => $data['currency'],
            'payment_terms' => $data['payment_terms'] ?? null,
            'rating' => isset($data['rating']) ? round((float) $data['rating'], 1) : 0,
            'rating_note' => $data['rating_note'] ?? null,
        ];
    }
}
