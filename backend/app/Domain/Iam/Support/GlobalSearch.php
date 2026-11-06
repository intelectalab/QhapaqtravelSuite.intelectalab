<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class GlobalSearch
{
    public const MIN = 2;

    public const LIMIT = 12;

    private const SOURCES = [
        'client' => ['label' => 'Cliente', 'route' => '/crm/clientes', 'table' => 'crm_clients', 'code' => 'code', 'title' => 'name', 'subtitle' => 'email', 'fields' => ['code', 'name', 'doc_number', 'email'], 'owner' => null, 'href' => '/crm/clientes/'],
        'lead' => ['label' => 'Lead', 'route' => '/crm/leads', 'table' => 'crm_leads', 'code' => 'code', 'title' => 'full_name', 'subtitle' => 'destination_label', 'fields' => ['code', 'full_name', 'company', 'email'], 'owner' => 'owner_id', 'href' => '/crm/leads/'],
        'opportunity' => ['label' => 'Oportunidad', 'route' => '/crm/oportunidades', 'table' => 'crm_opportunities', 'code' => 'code', 'title' => 'title', 'subtitle' => 'destination_label', 'fields' => ['code', 'title', 'destination_label'], 'owner' => 'owner_id', 'href' => '/crm/oportunidades/'],
        'quote' => ['label' => 'Cotización', 'route' => '/cotizaciones', 'table' => 'quote_quotes', 'code' => 'code', 'title' => 'title', 'subtitle' => 'status', 'fields' => ['code', 'title'], 'owner' => 'owner_id', 'href' => '/cotizaciones/'],
        'reservation' => ['label' => 'Reserva', 'route' => '/reservas', 'table' => 'booking_reservations', 'code' => 'code', 'title' => 'title', 'subtitle' => 'status', 'fields' => ['code', 'title'], 'owner' => 'owner_id', 'href' => '/reservas/'],
        'product' => ['label' => 'Producto', 'route' => '/catalogo', 'table' => 'catalog_products', 'code' => 'code', 'title' => 'name', 'subtitle' => 'status', 'fields' => ['code', 'name', 'sku'], 'owner' => null, 'href' => '/catalogo/productos/'],
        'provider' => ['label' => 'Proveedor', 'route' => '/catalogo/proveedores', 'table' => 'catalog_providers', 'code' => 'ref', 'title' => 'name', 'subtitle' => 'city', 'fields' => ['ref', 'name', 'ruc'], 'owner' => null, 'href' => null],
        'order' => ['label' => 'Orden operativa', 'route' => '/operaciones', 'table' => 'ops_orders', 'code' => 'code', 'title' => 'title', 'subtitle' => 'status', 'fields' => ['code', 'title'], 'owner' => null, 'href' => '/operaciones/ordenes/'],
    ];

    public function __construct(private readonly AccessMap $access) {}

    public function search(User $user, string $term): array
    {
        $term = trim($term);
        $like = '%'.addcslashes(mb_strtolower($term), '%_\\').'%';
        $ownOnly = Portfolio::ownOnly($user);
        $types = collect(self::SOURCES)->filter(fn (array $source): bool => $this->access->allows($user, $source['route']));

        $exact = [];
        $partial = [];

        foreach ($types as $type => $source) {
            foreach ($this->query($source, $like, $ownOnly ? (string) $user->getKey() : null) as $row) {
                $item = [
                    'type' => $type,
                    'type_label' => $source['label'],
                    'code' => $row->code,
                    'title' => $row->title,
                    'subtitle' => $row->subtitle,
                    'href' => $source['href'] === null ? $source['route'] : $source['href'].rawurlencode((string) $row->code),
                ];

                if (mb_strtolower((string) $row->code) === mb_strtolower($term)) {
                    $exact[] = $item;
                } else {
                    $partial[] = $item;
                }
            }
        }

        return [
            'items' => array_slice([...$exact, ...$partial], 0, self::LIMIT),
            'types' => $types->keys()->values()->all(),
            'scope' => $ownOnly ? 'own' : 'tenant',
        ];
    }

    private function query(array $source, string $like, ?string $owner): Collection
    {
        return DB::table($source['table'])
            ->whereNull('deleted_at')
            ->where(function (Builder $query) use ($source, $like): void {
                foreach ($source['fields'] as $field) {
                    $query->orWhereRaw("lower(coalesce({$field}::text, '')) like ?", [$like]);
                }
            })
            ->when($owner !== null && $source['owner'] !== null, fn (Builder $query) => $query->where($source['owner'], $owner))
            ->orderByDesc('updated_at')
            ->limit(self::LIMIT)
            ->get(["{$source['code']} as code", "{$source['title']} as title", "{$source['subtitle']} as subtitle"]);
    }
}
