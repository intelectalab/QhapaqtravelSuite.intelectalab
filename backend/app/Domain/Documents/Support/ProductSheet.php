<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class ProductSheet
{
    public const DOC_TYPE = 'ficha_comercial';

    public function __construct(
        private readonly AgencyLetterhead $agency,
        private readonly TravelItinerary $itinerary,
        private readonly TravelPolicies $policies,
    ) {}

    public function draft(string $productId): DocumentDraft
    {
        $product = DB::table('catalog_products as p')
            ->leftJoin('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->leftJoin('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->where('p.id', $productId)->whereNull('p.deleted_at')
            ->first(['p.id', 'p.code', 'p.name', 'p.short_description', 'p.long_description', 'p.duration_value', 'p.duration_unit', 'p.modality', 'p.minimum_passengers', 'p.maximum_passengers', 'p.minimum_age', 'p.updated_at', 't.name as type', 'd.name as destination'])
            ?? throw new RuntimeException("Producto {$productId} inexistente.");
        $agency = $this->agency->current();
        $days = DB::table('catalog_itineraries as i')->join('catalog_itinerary_days as d', 'd.itinerary_id', '=', 'i.id')
            ->where('i.product_id', $productId)->where('i.is_default', true)->orderBy('d.day_number')->get(['d.id', 'd.day_number', 'd.title']);
        $steps = DB::table('catalog_itinerary_items')->whereIn('day_id', $days->pluck('id'))->orderByRaw('start_time nulls last')->orderBy('activity')->get(['day_id', 'start_time', 'activity', 'location', 'note'])->groupBy('day_id');
        $rate = DB::table('catalog_rates')->where('product_id', $productId)->where('status', 'vigente')->whereIn('rate_type', ['Venta', 'Retail'])->whereIn('segment', ['Adulto', 'Pasajero'])
            ->orderBy('price')->first(['price', 'currency', 'price_basis', 'segment']);
        $policy = DB::table('catalog_product_policies')->where('product_id', $productId)->first(['cancellation', 'modification', 'no_show', 'refund']);
        $requirements = DB::table('catalog_product_requirements')->where('product_id', $productId)->orderBy('created_at')->pluck('text')->all();

        $data = [
            'agency' => $agency,
            'document' => [
                'kind' => 'Ficha comercial',
                'code' => (string) $product->code,
                'reference' => (string) $product->code,
                'updated_on' => DocumentFormat::longDate(substr((string) $product->updated_at, 0, 10)),
            ],
            'product' => [
                'name' => (string) $product->name,
                'type' => $product->type,
                'destination' => $product->destination,
                'summary' => $product->short_description,
                'description' => $product->long_description,
                'duration' => rtrim(rtrim(number_format((float) $product->duration_value, 1, ',', ''), '0'), ',').' '.Str::lower((string) $product->duration_unit),
                'modality' => $product->modality,
                'group' => (int) $product->maximum_passengers > 0 ? "De {$product->minimum_passengers} a {$product->maximum_passengers} personas" : null,
                'min_age' => (int) $product->minimum_age > 0 ? "Desde {$product->minimum_age} años" : null,
                'price' => $rate ? ['amount' => number_format((float) $rate->price, 2, '.', ' '), 'currency' => trim((string) $rate->currency), 'basis' => Str::lower((string) ($rate->price_basis ?: 'por '.$rate->segment))] : null,
            ],
            'days' => $this->days($days->all(), $steps->all()),
            'inclusions' => $this->itinerary->inclusions(collect([(string) $product->id])),
            'requirements' => $requirements,
            'policies' => $this->policies->rows($policy ? (array) $policy : null),
        ];

        return $this->build($product, $data);
    }

    private function days(array $days, array $steps): array
    {
        $result = [];

        foreach ($days as $day) {
            $lines = [];

            foreach ($steps[$day->id] ?? [] as $step) {
                $lines[] = ['time' => DocumentFormat::time($step->start_time), 'text' => trim((string) $step->activity.($step->note ? " — {$step->note}" : '')), 'location' => $step->location];
            }

            $result[] = ['number' => (int) $day->day_number, 'title' => (string) $day->title, 'entries' => [['time' => null, 'title' => (string) $day->title, 'detail' => null, 'status' => null, 'steps' => $lines]]];
        }

        return $result;
    }

    private function build(object $product, array $data): DocumentDraft
    {
        return new DocumentDraft(
            docType: self::DOC_TYPE,
            entityType: 'catalog_products',
            entityId: (string) $product->id,
            view: 'documents.product-sheet',
            title: "Ficha comercial {$product->code}",
            fileName: "ficha-{$product->code}.pdf",
            data: $data,
        );
    }
}
