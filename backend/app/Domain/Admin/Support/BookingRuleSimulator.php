<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Catalog\Support\ProductQuotePreview;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

final class BookingRuleSimulator
{
    public function __construct(
        private readonly TenantBookingEngine $engines,
        private readonly ProductBookingConfig $config,
        private readonly RuleResolver $rules,
        private readonly TenantContext $context,
    ) {}

    public function plans(): array
    {
        return DB::table('plans')->where('status', '<>', 'retired')->orderBy('rank')->pluck('name')->all();
    }

    public function options(): array
    {
        return [
            'products' => DB::table('catalog_products as p')->whereNull('p.deleted_at')->whereExists(fn ($query) => $query->from('catalog_rates as r')->whereColumn('r.product_id', 'p.id')->where('r.status', 'vigente'))
                ->orderBy('p.name')->get(['p.code', 'p.name'])->map(fn (object $product): array => ['value' => $product->code, 'label' => $product->name, 'hint' => $product->code])->values()->all(),
            'plans' => $this->plans(),
            'current_plan' => (string) DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $this->context->idOrFail())->value('p.name'),
            'today' => CarbonImmutable::now($this->context->timezone())->toDateString(),
        ];
    }

    public function simulate(array $data): array
    {
        $product = DB::table('catalog_products')->whereNull('deleted_at')->where('code', $data['product'])->first(['id', 'code', 'name'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El producto elegido no existe.');
        $plan = $data['plan'] ?? null;
        $set = $this->rules->forTenant($plan);
        $engine = $this->engines->engine($plan);
        $engineProduct = $this->config->engineProduct((string) $product->id, $data['date']);
        $pax = ['adt' => (int) $data['adt'], 'chd' => (int) ($data['chd'] ?? 0), 'inf' => (int) ($data['inf'] ?? 0)];
        $day = $engine->dayStatus($engineProduct, $data['date'], $pax['adt'] + $pax['chd']);
        $validation = $engine->validatePax($engineProduct, $pax);
        $selection = [
            'date' => $data['date'],
            'pax' => $pax,
            'currency' => $data['currency'] ?? 'PEN',
            'payment_mode' => $data['payment_mode'] ?? null,
            'payment_method' => $data['payment_method'] ?? null,
            'promo_code' => $data['promo_code'] ?? null,
            'channel' => $data['channel'] ?? 'Directo',
        ];
        $warning = null;

        try {
            $quote = $engine->quote($engineProduct, QuoteSelection::fromArray($selection));
        } catch (DomainException $exception) {
            $warning = $exception->getMessage() === 'R-MULTICURRENCY' ? 'Con este plan o configuración solo se cotiza en la moneda base (R-MULTICURRENCY).' : $exception->getMessage();
            $quote = $engine->quote($engineProduct, QuoteSelection::fromArray([...$selection, 'currency' => 'PEN']));
        }

        $summary = $set->summary();
        $catalog = DB::table('sys_booking_rules')->orderBy('sort_order')->get(['code', 'name', 'rule_group', 'enabled']);

        return [
            'product' => ['code' => $product->code, 'name' => $product->name],
            'plan' => $plan,
            'current_plan' => $plan === null,
            'day' => ['status' => $day->status, 'label' => $day->label, 'left' => $day->left, 'note' => $day->note],
            'pax' => ['ok' => $validation->ok, 'errors' => $validation->errors, 'seats' => $validation->seats],
            'quote' => ProductQuotePreview::serialize($quote),
            'warning' => $warning,
            'rules' => $catalog->map(fn (object $rule): array => [
                'code' => $rule->code,
                'name' => $rule->name,
                'group' => $rule->rule_group,
                'enabled' => (bool) $rule->enabled,
                'effective' => $set->on($rule->code, $engineProduct),
                'plan_allows' => $set->planAllows($rule->code),
                'overridden' => (bool) ($summary[$rule->code]['effective'] ?? false) && ! $set->on($rule->code, $engineProduct),
            ])->values()->all(),
        ];
    }
}
