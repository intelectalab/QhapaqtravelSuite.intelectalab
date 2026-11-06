<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProviderDirectory
{
    public const TYPES = ['Hotel', 'Transporte', 'Tren', 'Guía', 'Conductor', 'Restaurante', 'Operador', 'Actividad', 'Entrada', 'Otros'];

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $contacts = DB::table('catalog_provider_contacts')->orderBy('name')->get(['id', 'provider_id', 'name', 'role', 'phone', 'email'])->groupBy('provider_id');
        $services = DB::table('catalog_services')->whereNull('deleted_at')->orderBy('name')->get(['provider_id', 'ref', 'name', 'type', 'status'])->groupBy('provider_id');
        $products = DB::table('catalog_products')->whereNull('deleted_at')->whereNotNull('main_provider_id')->orderBy('name')->get(['main_provider_id', 'code', 'name', 'status'])->groupBy('main_provider_id');

        $providers = DB::table('catalog_providers')->whereNull('deleted_at')->orderBy('name')->get()
            ->map(fn (object $provider) => [
                'id' => $provider->id,
                'ref' => $provider->ref,
                'name' => $provider->name,
                'type' => $provider->type,
                'ruc' => trim($provider->ruc),
                'city' => $provider->city,
                'stars' => $provider->stars === null ? null : (int) $provider->stars,
                'contact_name' => $provider->contact_name,
                'phone' => $provider->phone,
                'email' => $provider->email,
                'contract_start' => $provider->contract_start,
                'contract_end' => $provider->contract_end,
                'contract_days' => CatalogAccess::daysUntil($provider->contract_end),
                'currency' => trim($provider->currency),
                'payment_terms' => $provider->payment_terms,
                'status' => $provider->status,
                'state' => ServiceDirectory::providerState($provider, $today),
                'rating' => (float) $provider->rating,
                'rating_note' => $provider->rating_note,
                'contacts' => self::pick($contacts, $provider->id, ['id', 'name', 'role', 'phone', 'email']),
                'services' => self::pick($services, $provider->id, ['ref', 'name', 'type', 'status']),
                'products' => self::pick($products, $provider->id, ['code', 'name', 'status']),
            ]);

        return [
            'today' => $today,
            'providers' => $providers,
            'options' => ['types' => self::TYPES, 'currencies' => CatalogAccess::CURRENCIES],
            'can' => ['manage' => $viewer->can('catalog.providers.manage')],
        ];
    }

    public static function group(Collection $grouped, string $key): array
    {
        $items = $grouped->get($key);

        return $items instanceof Collection ? array_values($items->all()) : [];
    }

    private static function pick(Collection $grouped, string $key, array $fields): array
    {
        $rows = [];

        foreach (self::group($grouped, $key) as $item) {
            $rows[] = array_intersect_key((array) $item, array_flip($fields));
        }

        return $rows;
    }
}
