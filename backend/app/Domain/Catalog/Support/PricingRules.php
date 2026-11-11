<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PricingRules
{
    public const KINDS = ['Markup %', 'Markup fijo', 'Descuento %', 'Descuento fijo', 'Impuesto %', 'Comisión %', 'Redondeo', 'Precio mínimo', 'Precio máximo'];

    public const CHANNELS = ['Directo', 'E-commerce', 'B2B', 'Corporativo', 'Mayorista'];

    public const RESIDENCIES = ['dom', 'nodom'];

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $rules = $this->rules();

        return [
            'today' => $today,
            'rules' => $rules->map(fn (object $rule) => $this->present($rule))->values(),
            'options' => [
                'kinds' => self::KINDS,
                'channels' => self::CHANNELS,
                'currencies' => CatalogAccess::CURRENCIES,
                'products' => DB::table('catalog_products as p')->whereNull('p.deleted_at')->whereIn('p.status', ['ACTIVE', 'APPROVED', 'REVIEW', 'DRAFT', 'SUSPENDED'])
                    ->whereExists(fn ($query) => $query->from('catalog_rates as r')->whereColumn('r.product_id', 'p.id'))
                    ->orderBy('p.name')->get(['p.id', 'p.code', 'p.name', 'p.status']),
                'rates' => DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->whereNull('p.deleted_at')
                    ->where('r.status', 'vigente')->where('r.valid_to', '>=', $today)
                    ->orderBy('r.ref')->get(['r.id', 'r.ref', 'r.product_id', 'r.rate_type', 'r.segment', 'r.channel', 'r.currency', 'r.cost', 'r.valid_from', 'r.valid_to'])
                    ->filter(fn (object $rate) => CatalogAccess::seesNetRates($viewer) || ! RateDirectory::isNet($rate->rate_type, $rate->channel))
                    ->map(fn (object $rate) => [...(array) $rate, 'currency' => trim($rate->currency), 'cost' => (float) $rate->cost])
                    ->values(),
            ],
            'can' => ['manage' => $viewer->can('catalog.products.manage_rates')],
        ];
    }

    public function simulate(array $input): array
    {
        $rate = DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->where('r.id', $input['rate_id'])->whereNull('p.deleted_at')
            ->first(['r.*', 'p.code as product_code', 'p.name as product_name', 'p.status as product_status', 'p.markup_pct'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una tarifa del catálogo.');

        if ($rate->status !== 'vigente') {
            throw ApiException::unprocessable('PRD-BR-005', 'La tarifa está inactiva: no se puede aplicar.');
        }

        $date = (string) $input['date'];
        $pax = max(1, (int) $input['pax']);
        $currency = trim((string) $rate->currency);
        $context = ['channel' => $input['channel'], 'pax' => $pax, 'residency' => $input['residency'], 'product' => (string) $rate->product_id, 'currency' => $currency];
        $rules = $this->rules()->where('status', 'activa')->filter(fn (object $rule) => $this->applies($rule, $context))->sortBy('priority');
        $pick = fn (string $kind) => $rules->firstWhere('kind', $kind);
        $season = DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')->where('date_from', '<=', $date)->where('date_to', '>=', $date)
            ->orderBy('priority')->first(['ref', 'name', 'factor']);
        $factor = $season ? (float) $season->factor : 1.0;

        $markupRule = $pick('Markup %');
        $markupPct = isset($input['markup_pct']) ? (float) $input['markup_pct'] : ($markupRule ? (float) $markupRule->value : (float) ($rate->markup_pct ?? 0));
        $markupFixedRule = $pick('Markup fijo');
        $discountRule = $pick('Descuento %');
        $discountPct = isset($input['discount_pct']) ? (float) $input['discount_pct'] : ($discountRule ? (float) $discountRule->value : 0.0);
        $discountFixedRule = $pick('Descuento fijo');
        $taxRule = $pick('Impuesto %');
        $commissionRule = $pick('Comisión %');
        $roundRule = $pick('Redondeo');
        $minRule = $pick('Precio mínimo');
        $maxRule = $pick('Precio máximo');

        $cost = (float) $rate->cost * $pax;
        $seasonAdjust = $cost * ($factor - 1);
        $extra = (float) ($input['extra'] ?? 0);
        $base = $cost + $seasonAdjust + $extra;
        $markup = $base * $markupPct / 100 + ($markupFixedRule ? (float) $markupFixedRule->value : 0.0);
        $subtotal = $base + $markup;
        $discount = $subtotal * $discountPct / 100 + ($discountFixedRule ? (float) $discountFixedRule->value : 0.0) + (float) ($input['discount_fixed'] ?? 0);
        $net = $subtotal - $discount;
        $taxPct = $taxRule ? (float) $taxRule->value : 0.0;
        $tax = $net * $taxPct / 100;
        $total = $net + $tax;
        $round = $roundRule ? (float) $roundRule->value : 0.0;

        if ($round > 0) {
            $total = round($total / $round) * $round;
        }

        $limit = null;
        $unit = $total / $pax;

        if ($minRule && $unit < (float) $minRule->value) {
            $limit = ['rule' => $minRule->ref, 'kind' => 'minimo', 'value' => (float) $minRule->value];
        } elseif ($maxRule && $unit > (float) $maxRule->value) {
            $limit = ['rule' => $maxRule->ref, 'kind' => 'maximo', 'value' => (float) $maxRule->value];
        }

        if ($limit !== null) {
            $total = $limit['value'] * $pax;
            $unit = $limit['value'];
        }

        $commissionPct = $commissionRule ? (float) $commissionRule->value : 0.0;
        $commission = $net * $commissionPct / 100;
        $profit = $net - $base - $commission;
        $money = fn (float $value) => round($value, 2);

        return [
            'currency' => $currency,
            'rate' => ['ref' => $rate->ref, 'valid_from' => $rate->valid_from, 'valid_to' => $rate->valid_to, 'in_range' => $date >= $rate->valid_from && $date <= $rate->valid_to],
            'product' => ['code' => $rate->product_code, 'name' => $rate->product_name, 'active' => $rate->product_status === 'ACTIVE'],
            'season' => $season ? ['ref' => $season->ref, 'name' => $season->name, 'factor' => $factor] : null,
            'steps' => [
                ['id' => 'cost', 'label' => 'Costo del proveedor', 'amount' => $money($cost), 'note' => number_format((float) $rate->cost, 2).' × '.$pax.' pax', 'rule' => null],
                ['id' => 'season', 'label' => 'Ajuste de temporada', 'amount' => $money($seasonAdjust), 'note' => $season ? "{$season->name} ×".number_format($factor, 2) : 'Sin temporada', 'rule' => $season?->ref],
                ['id' => 'extra', 'label' => 'Costos adicionales', 'amount' => $money($extra), 'note' => null, 'rule' => null],
                ['id' => 'markup', 'label' => 'Markup', 'amount' => $money($markup), 'note' => number_format($markupPct, 1).' %', 'rule' => isset($input['markup_pct']) ? null : $markupRule?->ref],
                ['id' => 'subtotal', 'label' => 'Subtotal', 'amount' => $money($subtotal), 'note' => null, 'rule' => null, 'total' => true],
                ['id' => 'discount', 'label' => 'Descuentos', 'amount' => -$money($discount), 'note' => $discountPct ? number_format($discountPct, 1).' %' : null, 'rule' => isset($input['discount_pct']) ? null : $discountRule?->ref],
                ['id' => 'net', 'label' => 'Valor neto', 'amount' => $money($net), 'note' => null, 'rule' => null, 'total' => true],
                ['id' => 'tax', 'label' => 'Impuestos', 'amount' => $money($tax), 'note' => number_format($taxPct, 0).' %', 'rule' => $taxRule?->ref],
                ['id' => 'total', 'label' => 'Precio final', 'amount' => $money($total), 'note' => $round > 0 ? 'Redondeo a '.$round : null, 'rule' => $limit['rule'] ?? $roundRule?->ref, 'total' => true],
            ],
            'unit_price' => $money($unit),
            'commission' => ['amount' => $money($commission), 'pct' => $commissionPct, 'rule' => $commissionRule?->ref],
            'profit' => $money($profit),
            'margin_pct' => $net > 0 ? round($profit / $net * 100, 1) : 0.0,
            'limit' => $limit,
            'applied' => $rules->pluck('ref')->values(),
        ];
    }

    public function find(string $ref): object
    {
        return DB::table('catalog_price_rules')->where('ref', $ref)->first() ?? throw ApiException::notFound('La regla no existe.');
    }

    public function present(object $rule): array
    {
        return [
            'ref' => $rule->ref,
            'name' => $rule->name,
            'kind' => $rule->kind,
            'value' => (float) $rule->value,
            'scope' => $rule->scope,
            'channel' => $rule->channel,
            'min_pax' => $rule->min_pax !== null ? (int) $rule->min_pax : null,
            'residency' => $rule->customer_residency,
            'product' => $rule->product_id ? ['id' => $rule->product_id, 'code' => $rule->product_code, 'name' => $rule->product_name] : null,
            'currency' => $rule->currency !== null ? trim((string) $rule->currency) : null,
            'priority' => (int) $rule->priority,
            'status' => $rule->status,
        ];
    }

    private function applies(object $rule, array $context): bool
    {
        return ($rule->channel === null || $rule->channel === $context['channel'])
            && ($rule->min_pax === null || $context['pax'] >= (int) $rule->min_pax)
            && ($rule->customer_residency === null || $rule->customer_residency === $context['residency'])
            && ($rule->product_id === null || (string) $rule->product_id === $context['product'])
            && ($rule->currency === null || trim((string) $rule->currency) === $context['currency']);
    }

    private function rules(): Collection
    {
        return DB::table('catalog_price_rules as r')->leftJoin('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->orderBy('r.priority')->orderBy('r.ref')
            ->get(['r.*', 'p.code as product_code', 'p.name as product_name']);
    }
}
