<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Support\QuotePricing;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuoteBuilder
{
    public const VALIDITY_DAYS = 10;

    public const MAX_OVERRIDE = 50.0;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CodeSequence $codes,
        private readonly TenantContext $context,
        private readonly QuoteLifecycle $lifecycle,
    ) {}

    public function options(User $actor): array
    {
        $today = $this->today();
        $clients = Portfolio::scope(DB::table('crm_clients')->whereNull('deleted_at'), $actor, 'owner_id')->orderBy('name')->get(['code', 'name']);
        $opportunities = Portfolio::scope(DB::table('crm_opportunities as o')->join('crm_clients as c', 'c.id', '=', 'o.client_id')->whereNull('o.deleted_at')->whereNotIn('o.stage', ['ganada', 'perdida']), $actor, 'o.owner_id')
            ->orderBy('o.title')->get(['o.code', 'o.title', 'o.currency', 'o.pax', 'c.code as client_code']);
        $rates = DB::table('catalog_rates')->where('status', 'vigente')->where('rate_type', 'Venta')->where('valid_from', '<=', $today)->where('valid_to', '>=', $today)
            ->orderBy('price')->get(['product_id', 'segment', 'currency', 'price', 'cost'])->groupBy('product_id');

        return [
            'clients' => $clients,
            'opportunities' => $opportunities,
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('is_quoteable', true)->orderBy('name')->get(['id', 'code', 'name', 'duration_value', 'duration_unit'])
                ->map(fn (object $product): array => $this->productOption($product, collect($rates->get($product->id, [])))),
            'defaults' => ['valid_until' => Carbon::parse($today)->addDays(self::VALIDITY_DAYS)->toDateString(), 'tax_pct' => 18, 'max_discount' => $actor->can('quotes.discount_override') ? self::MAX_OVERRIDE : QuotePricing::MAX_DISCOUNT],
        ];
    }

    private function productOption(object $product, Collection $rates): array
    {
        return [
            'code' => $product->code,
            'name' => $product->name,
            'duration' => rtrim(rtrim((string) $product->duration_value, '0'), '.').' '.$product->duration_unit,
            'rates' => array_map(fn ($rate): array => ['segment' => $rate->segment, 'currency' => $rate->currency, 'price' => (float) $rate->price], $rates->values()->all()),
        ];
    }

    public function preview(array $data, User $actor): array
    {
        $items = $this->items($data['items'] ?? [], $data['currency'] ?? 'PEN');
        $discount = $this->discount((float) ($data['discount_pct'] ?? 0), $actor);
        $totals = QuotePricing::totals($items->all(), $discount, (float) ($data['tax_pct'] ?? 18));
        $seeMargin = $actor->can('finance.profitability') || $actor->can('catalog.products.view_profitability');

        return [
            'lines' => $items->map(fn (array $item) => ['total' => round($item['unit_price'] * $item['qty'] * $item['pax'], 2), 'margin_pct' => $seeMargin && $item['unit_price'] > 0 ? round(($item['unit_price'] - $item['unit_cost']) / $item['unit_price'] * 100, 1) : null])->values(),
            'totals' => [...$totals, 'cost_total' => $seeMargin ? $totals['cost_total'] : null, 'profit_total' => $seeMargin ? $totals['profit_total'] : null, 'margin_pct' => $seeMargin ? $totals['margin_pct'] : null],
            'needs_internal_approval' => $discount > 5 || $totals['margin_pct'] < 15,
        ];
    }

    public function create(array $data, User $actor): string
    {
        $client = $this->client($data['client_code'], $actor);
        $opportunity = ! empty($data['opportunity_code']) ? $this->opportunity($data['opportunity_code'], $client->id, $actor) : null;

        return DB::transaction(function () use ($data, $actor, $client, $opportunity): string {
            $code = $this->codes->next('quote_quotes', 'COT-'.Carbon::parse($this->today())->year.'-', 5);
            $quoteId = (string) Str::uuid7();
            DB::table('quote_quotes')->insert([
                'id' => $quoteId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'client_id' => $client->id,
                'opportunity_id' => $opportunity?->id,
                'owner_id' => $actor->getKey(),
                'status' => 'borrador',
                'current_version_no' => 1,
                ...$this->header($data),
                'created_by' => $actor->getKey(),
            ]);
            $versionId = $this->writeVersion($quoteId, 1, $data, $actor);
            DB::table('quote_quotes')->where('id', $quoteId)->update(['current_version_id' => $versionId]);
            $this->audit->log('Cotización', $code, 'crear', after: trim($data['title']));

            if ($opportunity && in_array($opportunity->stage, ['calificacion', 'descubrimiento'], true)) {
                DB::table('crm_opportunities')->where('id', $opportunity->id)->update(['stage' => 'cotizacion', 'probability' => 55, 'updated_at' => now()]);
                $this->audit->log('Oportunidad', $opportunity->code, 'cambio_etapa', $opportunity->stage, 'cotizacion');
            }

            return $code;
        });
    }

    public function update(string $code, array $data, int $version, User $actor): void
    {
        $quote = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->first() ?? throw ApiException::notFound('La cotización no existe.');

        if ($quote->status !== 'borrador') {
            throw ApiException::conflict('QTE-BR-10', 'Solo se edita una cotización en borrador. Crea una nueva versión para cambiarla.');
        }

        $client = $this->client($data['client_code'], $actor);
        $opportunity = ! empty($data['opportunity_code']) ? $this->opportunity($data['opportunity_code'], $client->id, $actor) : null;

        DB::transaction(function () use ($quote, $data, $version, $actor, $client, $opportunity): void {
            $updated = DB::table('quote_quotes')->where('id', $quote->id)->where('lock_version', $version)
                ->update([...$this->header($data), 'client_id' => $client->id, 'opportunity_id' => $opportunity?->id, 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta cotización mientras la editabas. Recarga la página e inténtalo de nuevo.');
            }

            $this->writeVersion($quote->id, (int) $quote->current_version_no, $data, $actor, $quote->current_version_id);
            $this->audit->log('Cotización', $quote->code, 'editar', after: 'Versión '.$quote->current_version_no);
            $this->lifecycle->voidInternalApprovals($quote->code, (string) $quote->current_version_id, 'edición del borrador');
        });
    }

    private function writeVersion(string $quoteId, int $number, array $data, User $actor, ?string $versionId = null): string
    {
        $items = $this->items($data['items'], $data['currency']);

        if ($items->isEmpty()) {
            throw ApiException::unprocessable('QTE-BR-04', 'Agrega al menos un servicio.');
        }

        $discount = $this->discount((float) ($data['discount_pct'] ?? 0), $actor);
        $totals = QuotePricing::totals($items->all(), $discount, (float) ($data['tax_pct'] ?? 18));
        $values = [
            'status' => 'borrador',
            'issued_on' => $this->today(),
            'author_id' => $actor->getKey(),
            'discount_pct' => $discount,
            'tax_pct' => (float) ($data['tax_pct'] ?? 18),
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'snapshot_label' => $items->map(fn (array $item) => $item['product_code'])->unique()->implode(' / '),
            'catalog_snapshot' => json_encode($items->map(fn (array $item) => ['product_id' => $item['product_id'], 'name' => $item['product_name']])->values()->all(), JSON_UNESCAPED_UNICODE),
            'policies_snapshot' => json_encode(DB::table('catalog_product_policies')->whereIn('product_id', $items->pluck('product_id'))->get(['product_id', 'cancellation', 'modification', 'no_show', 'refund'])->all(), JSON_UNESCAPED_UNICODE),
            'fx_rate' => $this->fx($data['currency']),
            'currency' => $data['currency'],
            ...$totals,
            'updated_by' => $actor->getKey(),
        ];

        if ($versionId) {
            DB::table('quote_versions')->where('id', $versionId)->update([...$values, 'updated_at' => now()]);
            DB::table('quote_items')->where('quote_version_id', $versionId)->delete();
        } else {
            $versionId = (string) Str::uuid7();
            DB::table('quote_versions')->insert([...$values, 'id' => $versionId, 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quoteId, 'version_no' => $number, 'created_by' => $actor->getKey()]);
        }

        foreach ($items->values() as $index => $item) {
            DB::table('quote_items')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'quote_version_id' => $versionId,
                'line_no' => $index + 1,
                'product_id' => $item['product_id'],
                'product_version' => '1.0',
                'segment' => $item['segment'],
                'service_date' => $item['date'],
                'qty' => $item['qty'],
                'pax' => $item['pax'],
                'unit_cost' => $item['unit_cost'],
                'unit_price' => $item['unit_price'],
                'price_source' => $item['price_source'],
                'created_by' => $actor->getKey(),
            ]);
        }

        return $versionId;
    }

    private function items(array $rows, string $currency): Collection
    {
        $codes = collect($rows)->pluck('product_code')->filter()->unique();
        $products = DB::table('catalog_products')->whereIn('code', $codes)->whereNull('deleted_at')->get(['id', 'code', 'name', 'status', 'is_quoteable'])->keyBy('code');

        return collect($rows)->map(function (array $row) use ($products, $currency): array {
            $product = $products[$row['product_code']] ?? throw ApiException::unprocessable('QTE-BR-05', 'Uno de los servicios no existe en el catálogo.');

            if ($product->status !== 'ACTIVE' || ! $product->is_quoteable) {
                throw ApiException::unprocessable('QTE-BR-05', "{$product->name} no está activo para cotizar.");
            }

            $segment = $row['segment'] ?? 'Adulto';
            $rate = DB::table('catalog_rates')->where('product_id', $product->id)->where('status', 'vigente')->where('rate_type', 'Venta')
                ->where('valid_from', '<=', $row['date'])->where('valid_to', '>=', $row['date'])
                ->orderByRaw('case when segment = ? then 0 else 1 end', [$segment])->orderByRaw('case when currency = ? then 0 else 1 end', [$currency])->first(['price', 'cost', 'currency']);
            $factor = $rate && $rate->currency !== $currency ? ($currency === 'PEN' ? $this->fx('USD') : 1 / $this->fx('USD')) : 1;
            $price = isset($row['unit_price']) && $row['unit_price'] !== '' ? (float) $row['unit_price'] : ($rate ? round((float) $rate->price * $factor, 2) : 0);

            if ($price <= 0 || (int) $row['qty'] <= 0 || (int) $row['pax'] <= 0) {
                throw ApiException::unprocessable('QTE-BR-07', "Revisa {$product->name}: precio, cantidad y pasajeros deben ser mayores que cero.");
            }

            return [
                'product_id' => $product->id,
                'product_code' => $product->code,
                'product_name' => $product->name,
                'date' => $row['date'],
                'qty' => (int) $row['qty'],
                'pax' => (int) $row['pax'],
                'segment' => $segment,
                'unit_price' => $price,
                'unit_cost' => $rate ? round((float) $rate->cost * $factor, 2) : 0.0,
                'price_source' => $rate && abs(round((float) $rate->price * $factor, 2) - $price) < 0.01 ? 'rate' : 'manual',
            ];
        });
    }

    private function header(array $data): array
    {
        return [
            'title' => trim($data['title']),
            'travel_from' => $data['travel_from'],
            'travel_to' => $data['travel_to'],
            'valid_until' => $data['valid_until'] ?? Carbon::parse($this->today())->addDays(self::VALIDITY_DAYS)->toDateString(),
            'currency' => $data['currency'],
            'fx_rate' => $this->fx($data['currency']),
            'pax_adt' => (int) ($data['pax_adt'] ?? 0),
            'pax_chd' => (int) ($data['pax_chd'] ?? 0),
            'pax_inf' => (int) ($data['pax_inf'] ?? 0),
        ];
    }

    private function discount(float $discount, User $actor): float
    {
        $limit = $actor->can('quotes.discount_override') ? self::MAX_OVERRIDE : QuotePricing::MAX_DISCOUNT;

        if ($discount < 0 || $discount > $limit) {
            throw ApiException::unprocessable('QTE-BR-08', "El descuento máximo que puedes aplicar es {$limit} %.");
        }

        return $discount;
    }

    private function client(string $code, User $actor): object
    {
        return Portfolio::scope(DB::table('crm_clients')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->first(['id', 'code'])
            ?? throw ApiException::unprocessable('QTE-BR-09', 'Elige un cliente de tu cartera.');
    }

    private function opportunity(string $code, string $clientId, User $actor): object
    {
        $opportunity = Portfolio::scope(DB::table('crm_opportunities')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->first(['id', 'code', 'client_id', 'stage'])
            ?? throw ApiException::unprocessable('QTE-BR-09', 'Elige una oportunidad tuya.');

        if (in_array($opportunity->stage, ['ganada', 'perdida'], true)) {
            throw ApiException::conflict('CRM-BR-25', 'No se puede cotizar una oportunidad cerrada.');
        }

        if ($opportunity->client_id !== $clientId) {
            throw ApiException::unprocessable('QTE-BR-09', 'La oportunidad es de otro cliente.');
        }

        return $opportunity;
    }

    private function fx(string $currency): float
    {
        return $currency === 'USD' ? (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->value('rate_pen') ?? 3.75) : 1.0;
    }

    private function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }
}
