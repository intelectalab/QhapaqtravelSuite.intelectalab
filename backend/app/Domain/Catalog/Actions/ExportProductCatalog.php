<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\ProductDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;

final class ExportProductCatalog
{
    public const FILTERS = ['status', 'type', 'category', 'destination', 'q'];

    private const COLUMNS = [
        'code' => 'Código',
        'name' => 'Producto',
        'type' => 'Tipo',
        'category' => 'Categoría',
        'subcategory' => 'Subcategoría',
        'destination' => 'Destino',
        'duration' => 'Duración',
        'modality' => 'Modalidad',
        'status' => 'Estado',
        'channels' => 'Canales',
        'price_from' => 'Precio desde',
        'featured' => 'Destacado',
    ];

    public function __construct(private readonly ProductDirectory $directory, private readonly AuditLogger $audit) {}

    public function __invoke(array $filters): array
    {
        $rows = $this->filtered($this->directory->list(), $filters);

        if ($rows->count() > 5000) {
            throw ApiException::unprocessable('EXPORT_TOO_LARGE', 'La exportación supera 5000 productos. Aplica un filtro y vuelve a intentarlo.');
        }

        $handle = fopen('php://temp', 'w+');
        fputcsv($handle, array_values(self::COLUMNS));
        foreach ($rows as $row) {
            fputcsv($handle, [
                $row['code'],
                $row['name'],
                $row['type'],
                $row['category'],
                $row['subcategory'] ?? '',
                $row['destination'],
                rtrim(rtrim(number_format((float) $row['duration']['value'], 2, '.', ''), '0'), '.').' '.$row['duration']['unit'],
                $row['modality'],
                $row['status'],
                implode(' · ', $row['channels']),
                $row['price_from'] ? "{$row['price_from']['currency']} {$row['price_from']['amount']}" : '',
                $row['featured'] ? 'sí' : 'no',
            ]);
        }
        rewind($handle);
        $csv = "\u{FEFF}".stream_get_contents($handle);
        fclose($handle);

        $described = collect($filters)->map(fn (string $value, string $key) => "{$key}={$value}")->implode(', ');
        $this->audit->log('Exportación', 'catalog-products', 'exportar', null, 'Productos del catálogo · CSV · '.$rows->count().' filas'.($described === '' ? '' : " · {$described}"));

        return [
            'format' => 'CSV',
            'filename' => 'productos-'.now('America/Lima')->format('Ymd-Hi').'.csv',
            'content_type' => 'text/csv; charset=UTF-8',
            'rows' => $rows->count(),
            'filters' => (object) $filters,
            'content' => $csv,
        ];
    }

    private function filtered(Collection $rows, array $filters): Collection
    {
        $filters = array_intersect_key($filters, array_flip(self::FILTERS));
        $q = isset($filters['q']) ? mb_strtolower($filters['q']) : null;

        return $rows->filter(function (array $row) use ($filters, $q): bool {
            foreach (['status', 'type', 'category', 'destination'] as $field) {
                if (isset($filters[$field]) && mb_strtolower((string) $row[$field]) !== mb_strtolower($filters[$field])) {
                    return false;
                }
            }

            return $q === null || str_contains(mb_strtolower($row['name'].' '.$row['code']), $q);
        })->values();
    }
}
