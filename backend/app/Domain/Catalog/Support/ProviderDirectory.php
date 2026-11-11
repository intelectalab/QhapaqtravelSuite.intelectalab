<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
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
                ...$this->row($provider, $today),
                'contacts' => self::pick($contacts, $provider->id, ['id', 'name', 'role', 'phone', 'email']),
                'services' => self::pick($services, $provider->id, ['ref', 'name', 'type', 'status']),
                'products' => self::pick($products, $provider->id, ['code', 'name', 'status']),
            ]);

        return [
            'today' => $today,
            'providers' => $providers,
            'options' => $this->options(),
            'can' => $this->can($viewer),
        ];
    }

    public function show(User $viewer, string $ref): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $provider = DB::table('catalog_providers')->where('ref', $ref)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El proveedor no existe.');
        $services = DB::table('catalog_services')->where('provider_id', $provider->id)->whereNull('deleted_at')->orderBy('name')->get(['id', 'ref', 'name', 'type', 'unit', 'cost', 'currency', 'valid_from', 'valid_to', 'status']);
        $components = DB::table('catalog_product_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereNull('p.deleted_at')
            ->where(fn ($query) => $query->where('i.provider_id', $provider->id)->orWhereIn('i.service_id', $services->pluck('id')))
            ->orderBy('p.name')->get(['p.code', 'p.name', 'p.status']);
        $main = DB::table('catalog_products')->whereNull('deleted_at')->where('main_provider_id', $provider->id)->orderBy('name')->get(['code', 'name', 'status']);
        $products = $main->map(fn (object $product): array => [...(array) $product, 'role' => 'principal'])
            ->concat($components->whereNotIn('code', $main->pluck('code'))->unique('code')->map(fn (object $product): array => [...(array) $product, 'role' => 'componente']))
            ->values();

        return [
            'today' => $today,
            'provider' => [
                ...$this->row($provider, $today),
                'contacts' => DB::table('catalog_provider_contacts')->where('provider_id', $provider->id)->orderBy('name')->get(['id', 'name', 'role', 'phone', 'email']),
                'services' => $services->map(fn (object $service): array => ['ref' => $service->ref, 'name' => $service->name, 'type' => $service->type, 'status' => $service->status])->values(),
                'products' => $main->map(fn (object $product): array => (array) $product)->values(),
            ],
            'services' => $services->map(fn (object $service): array => [
                'ref' => $service->ref,
                'name' => $service->name,
                'type' => $service->type,
                'unit' => $service->unit,
                'cost' => $seesCost ? $service->cost : null,
                'currency' => trim($service->currency),
                'valid_to' => $service->valid_to,
                'state' => ServiceDirectory::serviceState($service, $today),
            ])->values(),
            'products' => $products,
            'reservations' => $viewer->can('reservations.view') ? $this->reservations($viewer, $provider->id, $seesCost) : null,
            'payables' => $viewer->can('finance.payables') ? $this->payables($provider->id, $today) : null,
            'history' => $viewer->can('catalog.providers.manage') ? CatalogHistory::of('Proveedor', $provider->ref) : null,
            'options' => $this->options(),
            'can' => $this->can($viewer),
        ];
    }

    public static function group(Collection $grouped, string $key): array
    {
        $items = $grouped->get($key);

        return $items instanceof Collection ? array_values($items->all()) : [];
    }

    private function reservations(User $viewer, string $providerId, bool $seesCost): Collection
    {
        return Portfolio::scope(DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('s.provider_id', $providerId)
            ->orderByDesc('s.service_date')->limit(60)
            ->get(['r.code', 'r.status as reservation_status', 'c.name as client', 's.code as service_code', 's.name', 's.service_date', 's.pax', 's.status', 's.confirmation_code', 's.cost_amount', 's.currency'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'client' => $row->client,
                'service_code' => $row->service_code,
                'service' => $row->name,
                'date' => $row->service_date,
                'pax' => (int) $row->pax,
                'status' => $row->status,
                'confirmation_code' => $row->confirmation_code,
                'cost' => $seesCost ? $row->cost_amount : null,
                'currency' => trim((string) $row->currency),
            ]);
    }

    private function payables(string $providerId, string $today): Collection
    {
        return DB::table('fin_payables as f')->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->where('f.provider_id', $providerId)->whereNull('f.deleted_at')
            ->orderByRaw("case when f.status in ('pagada', 'anulada') then 1 else 0 end")->orderBy('f.due_date')->limit(60)
            ->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'r.code as reservation'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'reservation' => $row->reservation,
                'concept' => $row->concept,
                'due_date' => $row->due_date,
                'overdue' => $row->due_date !== null && $row->due_date < $today && ! in_array($row->status, ['pagada', 'anulada'], true),
                'amount' => $row->amount,
                'balance' => number_format(max(0, (float) $row->amount - (float) $row->paid_amount), 2, '.', ''),
                'currency' => trim((string) $row->currency),
                'status' => $row->status,
            ]);
    }

    private function row(object $provider, string $today): array
    {
        return [
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
        ];
    }

    private function options(): array
    {
        return ['types' => self::TYPES, 'currencies' => CatalogAccess::CURRENCIES];
    }

    private function can(User $viewer): array
    {
        return ['manage' => $viewer->can('catalog.providers.manage')];
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
