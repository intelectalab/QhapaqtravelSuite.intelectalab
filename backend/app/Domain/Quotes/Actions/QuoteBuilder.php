<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Booking\Support\LineRates;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Catalog\Support\RateDirectory;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Support\QuotePricing;
use App\Domain\Quotes\Support\QuoteSections;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuoteBuilder
{
    public const VALIDITY_DAYS = 10;

    public const MAX_OVERRIDE = '50';

    public const MAX_TAX = '18';

    private const DOMESTIC = ['perú', 'peru', 'pe'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SequenceService $sequences,
        private readonly TenantContext $context,
        private readonly QuoteLifecycle $lifecycle,
        private readonly TenantBookingEngine $engines,
        private readonly LineRates $lineRates,
        private readonly TenantSettings $settings,
    ) {}

    public static function validityDays(): int
    {
        $days = (int) (app(TenantSettings::class)->section('policies')['quote_validity_days'] ?? self::VALIDITY_DAYS);

        return $days > 0 ? $days : self::VALIDITY_DAYS;
    }

    public static function seesCost(User $actor): bool
    {
        return $actor->can('finance.profitability') || $actor->can('catalog.products.view_profitability') || $actor->can('quotes.approve_internal');
    }

    public static function domestic(?string $country): bool
    {
        return in_array(mb_strtolower(trim((string) $country)), self::DOMESTIC, true);
    }

    public function defaultTax(?string $country): string
    {
        if ($country !== null && ! self::domestic($country)) {
            return '0';
        }

        $tax = $this->settings->section('currency')['tax_pct'] ?? self::MAX_TAX;

        return is_numeric($tax) ? (string) BigDecimal::of((string) $tax)->strippedOfTrailingZeros() : self::MAX_TAX;
    }

    public function options(User $actor): array
    {
        $today = $this->today();
        $clients = Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $actor)->orderBy('name')->get(['code', 'name', 'country', 'segment_code'])
            ->map(fn (object $client): array => ['code' => $client->code, 'name' => $client->name, 'country' => $client->country, 'domestic' => self::domestic($client->country), 'channel' => LineRates::channelFor($client->segment_code)]);
        $opportunities = Portfolio::scope(DB::table('crm_opportunities as o')->join('crm_clients as c', 'c.id', '=', 'o.client_id')->whereNull('o.deleted_at')->whereNotIn('o.stage', ['ganada', 'perdida']), $actor, 'o.owner_id')
            ->orderBy('o.title')->get(['o.code', 'o.title', 'o.currency', 'o.pax', 'c.code as client_code']);
        $rates = DB::table('catalog_rates')->where('status', 'vigente')->where('rate_type', 'Venta')->where('valid_from', '<=', $today)->where('valid_to', '>=', $today)
            ->orderBy('price')->get(['product_id', 'segment', 'currency', 'price', 'cost'])->groupBy('product_id');

        $products = DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('is_quoteable', true)->orderBy('name')->get(['id', 'code', 'name', 'duration_value', 'duration_unit']);
        $catalog = $this->lineRates->catalog($products->pluck('id'));
        $seeCost = self::seesCost($actor);

        return [
            'clients' => $clients,
            'opportunities' => $opportunities,
            'products' => $products->map(fn (object $product): array => [
                ...$this->productOption($product, collect($rates->get($product->id, []))),
                'rates' => collect($catalog->get($product->id, []))->map(fn (object $rate): array => LineRates::option($rate, $seeCost))->values()->all(),
            ]),
            'defaults' => [
                'valid_until' => Carbon::parse($today)->addDays(self::validityDays())->toDateString(),
                'validity_days' => self::validityDays(),
                'tax_pct' => (float) $this->defaultTax(null),
                'max_tax' => (int) self::MAX_TAX,
                'max_discount' => (int) ($actor->can('quotes.discount_override') ? self::MAX_OVERRIDE : QuoteLifecycle::currentLimits()['max_discount']),
                'margin_floor' => (float) QuoteLifecycle::currentLimits()['margin_floor'],
            ],
            'can' => ['edit_cost' => $seeCost],
        ];
    }

    private function productOption(object $product, Collection $rates): array
    {
        return [
            'code' => $product->code,
            'name' => $product->name,
            'duration' => rtrim(rtrim((string) $product->duration_value, '0'), '.').' '.$product->duration_unit,
            'segments' => $this->segments((string) $product->id, $rates),
        ];
    }

    private function segments(string $productId, Collection $rates): array
    {
        $segments = [];

        foreach (RateDirectory::SEGMENTS as $segment) {
            $rate = $rates->firstWhere('segment', $segment);

            if ($rate !== null) {
                $segments[] = ['value' => $segment, 'price' => (string) $rate->price, 'currency' => trim((string) $rate->currency), 'pct' => null];
            } elseif ($segment === 'Niño' && $rates->whereIn('segment', ['Adulto', 'Pasajero'])->isNotEmpty()) {
                $paxRules = $this->engines->paxRulesFor($productId);

                if ($paxRules['childPays'] ?? true) {
                    $segments[] = ['value' => 'Niño', 'price' => null, 'currency' => null, 'pct' => rtrim(rtrim((string) ($paxRules['childPricePct'] ?? 100), '0'), '.')];
                }
            }
        }

        return $segments;
    }

    public function preview(array $data, User $actor, ?int $step = null): array
    {
        $client = null;

        if ($step !== null) {
            $client = $this->atStep(1, 'client_code', fn (): object => $this->client((string) $data['client_code'], $actor));
            $this->atStep(1, 'opportunity_code', fn (): ?object => empty($data['opportunity_code']) ? null : $this->opportunity((string) $data['opportunity_code'], (string) $client->id, $actor));
            $this->atStep(1, 'currency', fn (): string => $this->fx((string) $data['currency']));
        } elseif (! empty($data['client_code'])) {
            $client = $this->client((string) $data['client_code'], $actor);
        }

        $items = $step !== null && $step < 3 ? collect() : $this->atStep(3, null, fn (): Collection => $this->items($data['items'] ?? [], $data['currency'] ?? 'PEN', $client, $actor));
        $discount = $step !== null && $step < 4 ? '0.00' : $this->atStep(4, 'discount_pct', fn (): string => $this->discount((string) ($data['discount_pct'] ?? '0'), $actor));
        $tax = $this->atStep(4, 'tax_pct', fn (): string => $this->taxPct($data, $client));
        $totals = QuotePricing::totals($items->all(), $discount, $tax);
        $seeMargin = self::seesCost($actor);
        $fx = $this->fx((string) ($data['currency'] ?? 'PEN'));
        $pax = (int) ($data['pax_adt'] ?? 0) + (int) ($data['pax_chd'] ?? 0) + (int) ($data['pax_inf'] ?? 0);

        return [
            'lines' => $items->map(fn (array $item): array => [
                'rate_id' => $item['rate_id'],
                'rate_ref' => $item['rate_ref'],
                'unit_price' => $item['unit_price'],
                'unit_cost' => $seeMargin ? $item['unit_cost'] : null,
                'rate_price' => $item['rate_price'],
                'rate_cost' => $seeMargin ? $item['rate_cost'] : null,
                'price_source' => $item['price_source'],
                'season_factor' => $item['season_factor'],
                'total' => (string) QuotePricing::lineTotal($item['unit_price'], $item['qty'], $item['pax']),
                'margin_pct' => $seeMargin ? QuotePricing::lineMargin($item['unit_price'], $item['unit_cost']) : null,
            ])->values(),
            'totals' => [
                ...$totals,
                'cost_total' => $seeMargin ? $totals['cost_total'] : null,
                'profit_total' => $seeMargin ? $totals['profit_total'] : null,
                'margin_pct' => $seeMargin ? $totals['margin_pct'] : null,
                'tax_pct' => $tax,
                'grand_total_pen' => (string) Decimal::round2(BigDecimal::of($totals['grand_total'])->multipliedBy($fx)),
                'per_pax' => $pax > 0 ? (string) BigDecimal::of($totals['grand_total'])->dividedBy($pax, 2, RoundingMode::HALF_UP) : null,
            ],
            'tax_default' => $this->defaultTax($client?->country),
            'itinerary' => QuoteSections::itineraryFor($items->map(fn (array $item): object => (object) ['id' => $item['product_id'], 'code' => $item['product_code'], 'name' => $item['product_name'], 'service_date' => $item['date']])),
            'needs_internal_approval' => QuoteLifecycle::needsInternalApproval($discount, $totals['margin_pct'], QuoteLifecycle::currentLimits()),
        ];
    }

    public function create(array $data, User $actor): string
    {
        $client = $this->client($data['client_code'], $actor);
        $opportunity = ! empty($data['opportunity_code']) ? $this->opportunity($data['opportunity_code'], $client->id, $actor) : null;

        return DB::transaction(function () use ($data, $actor, $client, $opportunity): string {
            $code = $this->sequences->next('quote');
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
        $quote = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code)->first() ?? throw Portfolio::missing($actor, 'quote_quotes', $code, 'La cotización no existe.', 'Esta cotización');

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
        $client = $this->client((string) $data['client_code'], $actor);
        $items = $this->items($data['items'], $data['currency'], $client, $actor);

        if ($items->isEmpty()) {
            throw ApiException::unprocessable('QTE-BR-04', 'Agrega al menos un producto del catálogo.');
        }

        $discount = $this->discount((string) ($data['discount_pct'] ?? '0'), $actor);
        $tax = $this->taxPct($data, $client);
        $totals = QuotePricing::totals($items->all(), $discount, $tax);
        $values = [
            'status' => 'borrador',
            'issued_on' => $this->today(),
            'author_id' => $actor->getKey(),
            'discount_pct' => $discount,
            'tax_pct' => $tax,
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'conditions' => trim((string) ($data['conditions'] ?? '')) ?: null,
            'snapshot_label' => $items->map(fn (array $item) => $item['product_code'])->unique()->implode(' / '),
            'catalog_snapshot' => json_encode($items->map(fn (array $item) => ['product_id' => $item['product_id'], 'name' => $item['product_name']])->values()->all(), JSON_UNESCAPED_UNICODE),
            'policies_snapshot' => json_encode(DB::table('catalog_product_policies')->whereIn('product_id', $items->pluck('product_id'))->get(['product_id', 'cancellation', 'modification', 'no_show', 'refund', 'penalty_tiers'])->all(), JSON_UNESCAPED_UNICODE),
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
                'rate_id' => $item['rate_id'],
                'rate_snapshot' => $item['rate_snapshot'] === null ? null : json_encode($item['rate_snapshot'], JSON_UNESCAPED_UNICODE),
                'season_factor' => $item['season_factor'],
                'unit_cost' => $item['unit_cost'],
                'unit_price' => $item['unit_price'],
                'price_source' => $item['price_source'],
                'created_by' => $actor->getKey(),
            ]);
        }

        return $versionId;
    }

    private function items(array $rows, string $currency, ?object $client, User $actor): Collection
    {
        $codes = collect($rows)->pluck('product_code')->filter()->unique();
        $products = DB::table('catalog_products')->whereIn('code', $codes)->whereNull('deleted_at')->get(['id', 'code', 'name', 'status', 'is_quoteable'])->keyBy('code');
        $catalog = $this->lineRates->catalog($products->pluck('id'));
        $channel = LineRates::channelFor($client?->segment_code);
        $editCost = self::seesCost($actor);

        $line = function (array $row, int $index) use ($products, $currency, $catalog, $channel, $editCost): array {
            $field = ['field' => "items.{$index}.product_code"];
            $product = $products[$row['product_code']] ?? throw ApiException::unprocessable('QTE-BR-05', 'Uno de los productos no existe en el catálogo.', $field);

            if ($product->status !== 'ACTIVE' || ! $product->is_quoteable) {
                throw ApiException::unprocessable('QTE-BR-05', "{$product->name} no está activo para cotizar.", $field);
            }

            $segment = $row['segment'] ?? 'Adulto';
            $date = (string) $row['date'];
            $rates = collect($catalog->get($product->id, []));
            $manualMode = array_key_exists('rate_id', $row) && ($row['rate_id'] === null || $row['rate_id'] === '');
            $rate = null;

            if (! $manualMode && ! empty($row['rate_id'])) {
                $rate = $this->lineRates->find((string) $row['rate_id'], (string) $product->id);

                if (! LineRates::valid($rate, $date)) {
                    throw ApiException::unprocessable('QTE-BR-06', "La tarifa {$rate->ref} no está vigente el ".Carbon::parse($date)->format('d/m/Y').' (PRD-BR-005). Elige otra tarifa.', ['field' => "items.{$index}.rate_id"]);
                }
            } elseif (! $manualMode) {
                $rate = $this->lineRates->pick($rates, $date, $segment, $channel);
            }

            $companions = $rate === null ? [] : $rates->filter(fn (object $other): bool => $other->id !== $rate->id && $other->segment === 'Niño' && LineRates::valid($other, $date) && in_array($other->channel, [$rate->channel, 'Directo'], true));
            $priced = $rate === null ? null : $this->lineRates->price((string) $product->id, $rate, $segment, $date, $currency, $companions);

            if ($rate !== null && $priced === null) {
                throw ApiException::unprocessable('QTE-BR-06', "La tarifa {$rate->ref} es para {$rate->segment}: elige otra tarifa o el tipo {$rate->segment}.", ['field' => "items.{$index}.rate_id"]);
            }

            $ratePrice = $priced['price'] ?? null;
            $manual = isset($row['unit_price']) && $row['unit_price'] !== '' && is_numeric($row['unit_price']) ? (string) Decimal::round2((string) $row['unit_price']) : null;
            $price = $manual ?? $ratePrice ?? '0.00';
            $typedCost = $editCost && isset($row['unit_cost']) && $row['unit_cost'] !== '' && is_numeric($row['unit_cost']) ? (string) Decimal::round2((string) $row['unit_cost']) : null;
            $suggested = $rate === null && $manualMode ? $this->lineRates->pick($rates, $date, $segment, $channel) : null;
            $fallback = $suggested === null ? null : ($this->lineRates->price((string) $product->id, $suggested, $segment, $date, $currency)['cost'] ?? null);
            $cost = $typedCost ?? $priced['cost'] ?? $fallback;

            if (! BigDecimal::of($price)->isPositive() || (int) $row['qty'] <= 0 || (int) $row['pax'] <= 0) {
                throw ApiException::unprocessable('QTE-BR-07', "Revisa {$product->name}: precio, cantidad y pasajeros deben ser mayores que cero.", ['field' => "items.{$index}.unit_price"]);
            }

            if ($cost === null) {
                throw ApiException::unprocessable('QTE-BR-07', $editCost
                    ? "Indica el costo unitario de {$product->name}: sin tarifa el margen no se puede calcular."
                    : "{$product->name} no tiene tarifa para esa fecha: elige una tarifa o pide a Gerencia que registre el costo.", ['field' => "items.{$index}.unit_cost"]);
            }

            return [
                'product_id' => $product->id,
                'product_code' => $product->code,
                'product_name' => $product->name,
                'date' => $date,
                'qty' => (int) $row['qty'],
                'pax' => (int) $row['pax'],
                'segment' => $segment,
                'rate_id' => $rate?->id,
                'rate_ref' => $rate?->ref,
                'rate_snapshot' => $rate === null ? null : LineRates::snapshot($rate, $priced),
                'season_factor' => $this->lineRates->seasonFactor($date),
                'unit_price' => $price,
                'rate_price' => $ratePrice,
                'rate_cost' => $priced['cost'] ?? null,
                'unit_cost' => $cost,
                'price_source' => $ratePrice !== null && BigDecimal::of($ratePrice)->isEqualTo($price) ? 'rate' : 'manual',
            ];
        };
        $items = new Collection;

        foreach (array_values($rows) as $index => $row) {
            $items->push($line((array) $row, $index));
        }

        return $items;
    }

    private function atStep(int $step, ?string $field, callable $check): mixed
    {
        try {
            return $check();
        } catch (ApiException $error) {
            throw new ApiException($error->status, $error->error, $error->ruleCode, $error->getMessage(), $error->requiredPermissions, [...($field === null ? [] : ['field' => $field]), ...$error->details, 'step' => $step]);
        }
    }

    private function header(array $data): array
    {
        return [
            'title' => trim($data['title']),
            'travel_from' => $data['travel_from'],
            'travel_to' => $data['travel_to'],
            'valid_until' => $data['valid_until'] ?? Carbon::parse($this->today())->addDays(self::validityDays())->toDateString(),
            'currency' => $data['currency'],
            'fx_rate' => $this->fx($data['currency']),
            'pax_adt' => (int) ($data['pax_adt'] ?? 0),
            'pax_chd' => (int) ($data['pax_chd'] ?? 0),
            'pax_inf' => (int) ($data['pax_inf'] ?? 0),
        ];
    }

    private function discount(string $discount, User $actor): string
    {
        $limit = $actor->can('quotes.discount_override') ? self::MAX_OVERRIDE : QuoteLifecycle::currentLimits()['max_discount'];
        $value = is_numeric($discount) ? BigDecimal::of($discount) : null;

        if ($value === null || $value->isNegative() || $value->isGreaterThan($limit)) {
            throw ApiException::unprocessable('QTE-BR-08', "El descuento máximo que puedes aplicar es {$limit} %.");
        }

        return (string) $value->toScale(2, RoundingMode::HALF_UP);
    }

    private function taxPct(array $data, ?object $client): string
    {
        $tax = isset($data['tax_pct']) && is_numeric($data['tax_pct']) ? BigDecimal::of((string) $data['tax_pct']) : BigDecimal::of($this->defaultTax($client?->country));

        if ($tax->isNegative() || $tax->isGreaterThan(self::MAX_TAX)) {
            throw ApiException::unprocessable('PRC-07', 'El IGV va de 0 a 18 %.', ['field' => 'tax_pct']);
        }

        return (string) $tax->toScale(2, RoundingMode::HALF_UP);
    }

    private function client(string $code, User $actor): object
    {
        return Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $actor)->where('code', $code)->first(['id', 'code', 'country', 'segment_code'])
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

    public function fx(string $currency): string
    {
        if ($currency === 'PEN') {
            return '1';
        }

        return (string) (DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen')
            ?? throw ApiException::unprocessable('CFG-FX', "No hay tipo de cambio registrado para {$currency}."));
    }

    private function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }
}
