<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Shared\Money\Decimal;
use Illuminate\Support\Facades\DB;

final class QuoteProposalSheet
{
    public const DOC_TYPE = 'propuesta_cotizacion';

    public function __construct(
        private readonly AgencyLetterhead $agency,
        private readonly TravelItinerary $itinerary,
        private readonly TravelPolicies $policies,
        private readonly ClientParty $parties,
    ) {}

    public function draft(string $versionId): DocumentDraft
    {
        $version = DB::table('quote_versions')->where('id', $versionId)->first() ?? throw new \RuntimeException("Versión {$versionId} inexistente.");
        $quote = DB::table('quote_quotes')->where('id', $version->quote_id)->first();
        $currency = (string) $version->currency;
        $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')
            ->where('i.quote_version_id', $version->id)->orderBy('i.service_date')->orderBy('i.line_no')
            ->get(['i.line_no', 'i.service_date', 'i.qty', 'i.pax', 'i.segment', 'i.unit_price', 'i.sale_total', 'p.id as product_id', 'p.name', 'p.duration_value', 'p.duration_unit', 'p.modality']);
        $productIds = $items->pluck('product_id')->unique()->values();
        $tax = Decimal::of((string) $version->tax_total);
        $discount = Decimal::of((string) $version->discount_total);

        $data = [
            'agency' => $this->agency->current(),
            'document' => [
                'kind' => 'Propuesta de viaje',
                'code' => (string) $quote->code,
                'reference' => "{$quote->code} · versión {$version->version_no}",
                'version' => (int) $version->version_no,
                'issued_on' => DocumentFormat::longDate((string) $version->issued_on),
                'valid_until' => DocumentFormat::longDate((string) $quote->valid_until),
            ],
            'trip' => [
                'title' => (string) $quote->title,
                'dates' => DocumentFormat::range((string) $quote->travel_from, (string) $quote->travel_to),
                'duration' => DocumentFormat::duration((string) $quote->travel_from, (string) $quote->travel_to),
                'travellers' => DocumentFormat::pax((int) $quote->pax_adt, (int) $quote->pax_chd, (int) $quote->pax_inf),
            ],
            'client' => $this->parties->client((string) $quote->client_id),
            'advisor' => $this->parties->advisor((string) $quote->owner_id),
            'days' => $this->itinerary->days($items->map(fn (object $item): array => [
                'date' => (string) $item->service_date,
                'time' => null,
                'title' => (string) $item->name,
                'detail' => $this->detail($item),
                'product_id' => (string) $item->product_id,
                'status' => null,
            ]), (string) $quote->travel_from),
            'lines' => $items->sortBy('line_no')->map(fn (object $item): array => [
                'date' => DocumentFormat::date((string) $item->service_date),
                'name' => (string) $item->name,
                'segment' => (string) $item->segment,
                'quantity' => $this->quantity((int) $item->qty, (int) $item->pax),
                'unit' => DocumentFormat::money((string) $item->unit_price, $currency),
                'total' => DocumentFormat::money((string) $item->sale_total, $currency),
            ])->values()->all(),
            'totals' => array_values(array_filter([
                $discount->isPositive() ? ['label' => 'Servicios', 'value' => DocumentFormat::money((string) $version->sale_total, $currency)] : null,
                $discount->isPositive() ? ['label' => 'Descuento ('.DocumentFormat::percent((string) $version->discount_pct).')', 'value' => '− '.DocumentFormat::money($discount, $currency)] : null,
                $tax->isPositive() ? ['label' => 'Valor de venta', 'value' => DocumentFormat::money((string) $version->net_total, $currency)] : null,
                $tax->isPositive() ? ['label' => 'IGV ('.DocumentFormat::percent((string) $version->tax_pct).')', 'value' => DocumentFormat::money($tax, $currency)] : null,
            ])),
            'grand_total' => DocumentFormat::money((string) $version->grand_total, $currency),
            'currency_note' => $currency === 'USD' ? 'Importes en dólares estadounidenses. Tipo de cambio referencial: S/ '.number_format((float) $version->fx_rate, 3, '.', '').' por dólar.' : 'Importes en soles.',
            'inclusions' => $this->itinerary->inclusions($productIds),
            'conditions' => trim((string) $version->conditions) ?: null,
            'payment_terms' => $this->policies->paymentTerms(),
            'policies' => $this->policies->rows($version->policies_snapshot),
        ];

        return new DocumentDraft(self::DOC_TYPE, 'quote_versions', (string) $version->id, 'documents.quote-proposal', "Propuesta {$quote->code} v{$version->version_no}", "{$quote->code}-v{$version->version_no}.pdf", $data);
    }

    private function detail(object $item): string
    {
        $duration = rtrim(rtrim((string) $item->duration_value, '0'), '.');

        return trim(implode(' · ', array_filter([(string) $item->modality, "{$duration} {$item->duration_unit}", DocumentFormat::count((int) $item->pax * (int) $item->qty, 'pasajero', 'pasajeros')])));
    }

    private function quantity(int $qty, int $pax): string
    {
        return $qty === 1 ? DocumentFormat::count($pax, 'pasajero', 'pasajeros') : "{$qty} unid. × ".DocumentFormat::count($pax, 'pasajero', 'pasajeros');
    }
}
