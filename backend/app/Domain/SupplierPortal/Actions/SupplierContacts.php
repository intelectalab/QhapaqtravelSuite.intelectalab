<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use Illuminate\Support\Facades\DB;

final class SupplierContacts
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function save(SupplierAccount $account, ?string $id, array $data): void
    {
        DB::transaction(function () use ($account, $id, $data): void {
            $values = [
                'name' => trim((string) $data['name']),
                'role' => $data['role'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => isset($data['email']) ? mb_strtolower((string) $data['email']) : null,
                'updated_by' => $account->user->getKey(),
                'updated_at' => now(),
            ];

            if ($id === null) {
                DB::table('catalog_provider_contacts')->insert([...$values, 'provider_id' => $account->id(), 'created_by' => $account->user->getKey()]);
                $this->audit->log('Proveedor', $account->provider->ref, 'agregar_contacto', null, $this->label($values));

                return;
            }

            $contact = $account->contact($id);
            DB::table('catalog_provider_contacts')->where('id', $contact->id)->update($values);
            $this->audit->log('Proveedor', $account->provider->ref, 'editar_contacto', $this->label((array) $contact), $this->label($values));
        });
    }

    public function delete(SupplierAccount $account, string $id): void
    {
        DB::transaction(function () use ($account, $id): void {
            $contact = $account->contact($id);

            if (DB::table('catalog_provider_contacts')->where('provider_id', $account->id())->count() <= 1) {
                throw ApiException::conflict('SUP-BR-60', 'La agencia necesita al menos un contacto de su empresa.');
            }

            DB::table('catalog_provider_contacts')->where('id', $contact->id)->delete();
            $this->audit->log('Proveedor', $account->provider->ref, 'quitar_contacto', $this->label((array) $contact), null);
        });
    }

    private function label(array $values): string
    {
        return collect([$values['name'] ?? null, $values['role'] ?? null, $values['email'] ?? null, $values['phone'] ?? null])->filter()->implode(' · ');
    }
}
