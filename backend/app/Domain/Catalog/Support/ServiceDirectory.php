<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class ServiceDirectory
{
    public const TYPES = ['Traslado', 'Transporte', 'Tren', 'Entrada', 'Guía', 'Alimentación', 'Alojamiento', 'Actividad', 'Tour', 'Seguro', 'Otro'];

    public const UNITS = ['pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad'];

    public static function providerState(object $provider, string $today): string
    {
        return $provider->status === 'activo' && $provider->contract_end < $today ? 'vencido' : $provider->status;
    }

    public static function serviceState(object $service, string $today): string
    {
        return $service->status === 'activo' && $service->valid_to < $today ? 'vencido' : $service->status;
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $usage = DB::table('catalog_product_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereNull('p.deleted_at')->whereNotNull('i.service_id')
            ->get(['i.service_id', 'p.code', 'p.name'])->groupBy('service_id');

        $services = $this->query()->orderBy('s.name')->get()
            ->map(function (object $service) use ($today, $seesCost, $usage) {
                $products = [];

                foreach (ProviderDirectory::group($usage, $service->id) as $item) {
                    $products[$item->code] = ['code' => $item->code, 'name' => $item->name];
                }

                return [...$this->row($service, $today, $seesCost), 'products' => array_values($products)];
            });

        return [
            'today' => $today,
            'services' => $services,
            'options' => $this->options($today),
            'can' => $this->can($viewer, $seesCost),
        ];
    }

    public function show(User $viewer, string $ref): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $service = $this->query()->where('s.ref', $ref)->first() ?? throw ApiException::notFound('El servicio no existe.');
        $provider = DB::table('catalog_providers')->where('id', $service->provider_id)->first(['id', 'ref', 'name', 'type', 'status', 'contract_start', 'contract_end', 'payment_terms', 'currency', 'rating']);
        $items = DB::table('catalog_product_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereNull('p.deleted_at')->where('i.service_id', $service->id)
            ->orderBy('p.name')->get(['p.code', 'p.name', 'p.status', 'i.quantity', 'i.unit', 'i.is_required', 'i.is_included']);
        $fx = trim($service->currency) === 'PEN' ? null : DB::table('fin_fx_rates')->where('currency_code', trim($service->currency))->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);
        $manages = $viewer->canAny(['catalog.providers.manage', 'catalog.products.update']);

        return [
            'today' => $today,
            'service' => [
                ...$this->row($service, $today, $seesCost),
                'products' => $items->unique('code')->map(fn (object $item): array => ['code' => $item->code, 'name' => $item->name])->values(),
                'scheduled_cost' => $seesCost ? $service->scheduled_cost : null,
                'scheduled_cost_from' => $seesCost ? $service->scheduled_cost_from : null,
            ],
            'fx' => $seesCost && $fx ? ['rate' => (float) $fx->rate_pen, 'date' => $fx->rate_date, 'cost_pen' => round((float) $service->cost * (float) $fx->rate_pen, 2)] : null,
            'provider' => $provider ? [
                'id' => $provider->id,
                'ref' => $provider->ref,
                'name' => $provider->name,
                'type' => $provider->type,
                'state' => self::providerState($provider, $today),
                'contract_start' => $provider->contract_start,
                'contract_end' => $provider->contract_end,
                'contract_days' => CatalogAccess::daysUntil($provider->contract_end),
                'payment_terms' => $provider->payment_terms,
                'currency' => trim($provider->currency),
                'rating' => (float) $provider->rating,
            ] : null,
            'usage' => $items->map(fn (object $item): array => [
                'code' => $item->code,
                'name' => $item->name,
                'status' => $item->status,
                'quantity' => (float) $item->quantity,
                'unit' => $item->unit,
                'required' => (bool) $item->is_required,
                'included' => (bool) $item->is_included,
            ])->values(),
            'cost_history' => $seesCost ? DB::table('catalog_service_cost_history')->where('service_id', $service->id)->orderByDesc('effective_from')
                ->get(['cost', 'currency', 'effective_from', 'effective_to', 'source']) : [],
            'history' => $manages ? CatalogHistory::of('Servicio', $service->ref) : null,
            'options' => $this->options($today),
            'can' => $this->can($viewer, $seesCost),
        ];
    }

    private function query(): Builder
    {
        return DB::table('catalog_services as s')
            ->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->whereNull('s.deleted_at')
            ->select(['s.*', 'pv.ref as provider_ref', 'pv.name as provider_name', 'pv.status as provider_status', 'pv.contract_end']);
    }

    private function row(object $service, string $today, bool $seesCost): array
    {
        return [
            'ref' => $service->ref,
            'name' => $service->name,
            'type' => $service->type,
            'unit' => $service->unit,
            'cost' => $seesCost ? $service->cost : null,
            'currency' => trim($service->currency),
            'capacity' => $service->capacity === null ? null : (int) $service->capacity,
            'valid_from' => $service->valid_from,
            'valid_to' => $service->valid_to,
            'status' => $service->status,
            'state' => self::serviceState($service, $today),
            'expires_in' => CatalogAccess::daysUntil($service->valid_to),
            'provider' => [
                'id' => $service->provider_id,
                'ref' => $service->provider_ref,
                'name' => $service->provider_name,
                'state' => self::providerState((object) ['status' => $service->provider_status, 'contract_end' => $service->contract_end], $today),
            ],
        ];
    }

    private function options(string $today): array
    {
        return [
            'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name', 'type', 'status', 'contract_end'])
                ->map(fn (object $provider) => ['id' => $provider->id, 'name' => $provider->name, 'type' => $provider->type, 'state' => self::providerState($provider, $today)]),
            'types' => self::TYPES,
            'units' => self::UNITS,
            'currencies' => CatalogAccess::CURRENCIES,
        ];
    }

    private function can(User $viewer, bool $seesCost): array
    {
        return ['manage' => $viewer->can('catalog.providers.manage'), 'see_cost' => $seesCost];
    }
}
