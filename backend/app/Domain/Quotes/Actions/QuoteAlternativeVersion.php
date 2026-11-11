<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Booking\Support\LineRates;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class QuoteAlternativeVersion
{
    public function __construct(
        private readonly QuoteLifecycle $lifecycle,
        private readonly QuoteBuilder $builder,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function handle(string $code, array $dates, User $actor): int
    {
        $today = Carbon::now($this->context->timezone())->toDateString();
        $moves = [];

        foreach ($dates as $row) {
            $date = Carbon::parse((string) $row['date'])->toDateString();

            if ($date < $today) {
                throw ApiException::unprocessable('QTE-BR-06', 'La fecha alternativa no puede ser anterior a hoy.', ['field' => 'dates']);
            }

            $moves[(int) $row['line']] = $date;
        }

        return DB::transaction(function () use ($code, $moves, $actor): int {
            $before = DB::table('quote_quotes as q')->join('quote_versions as v', 'v.id', '=', 'q.current_version_id')->where('q.code', $code)->whereNull('q.deleted_at')->first(['v.id', 'v.grand_total', 'v.currency']);
            $lines = $before === null ? collect() : DB::table('quote_items')->where('quote_version_id', $before->id)->pluck('line_no')->map(fn ($line): int => (int) $line);
            $unknown = array_diff(array_keys($moves), $lines->all());

            if ($before !== null && $unknown !== []) {
                throw ApiException::unprocessable('QTE-BR-06', 'Una de las líneas elegidas no está en la versión vigente.', ['field' => 'dates']);
            }

            $this->lifecycle->newVersion($code, $actor);
            $quote = DB::table('quote_quotes')->where('code', $code)->whereNull('deleted_at')->first();
            $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first();
            $client = DB::table('crm_clients')->where('id', $quote->client_id)->value('code');
            $opportunity = $quote->opportunity_id === null ? null : DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->whereNotIn('stage', ['ganada', 'perdida'])->value('code');
            $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->where('i.quote_version_id', $version->id)->orderBy('i.line_no')
                ->get(['i.line_no', 'i.service_date', 'i.qty', 'i.pax', 'i.segment', 'i.rate_id', 'i.unit_price', 'i.unit_cost', 'i.price_source', 'p.code as product_code']);
            $rows = $items->map(fn (object $item): array => $this->row($item, $moves[(int) $item->line_no] ?? null))->all();
            $serviceDates = array_column($rows, 'date');
            $shift = (int) Carbon::parse((string) $items->min('service_date'))->diffInDays(Carbon::parse(min($serviceDates)), false);
            $from = min(Carbon::parse((string) $quote->travel_from)->addDays($shift)->toDateString(), min($serviceDates));
            $to = max(Carbon::parse((string) $quote->travel_to)->addDays($shift)->toDateString(), max($serviceDates), $from);

            $this->builder->update($code, [
                'client_code' => $client,
                'opportunity_code' => $opportunity,
                'title' => $quote->title,
                'travel_from' => $from,
                'travel_to' => $to,
                'valid_until' => $quote->valid_until,
                'currency' => $version->currency,
                'pax_adt' => (int) $quote->pax_adt,
                'pax_chd' => (int) $quote->pax_chd,
                'pax_inf' => (int) $quote->pax_inf,
                'discount_pct' => (string) $version->discount_pct,
                'tax_pct' => (string) $version->tax_pct,
                'notes' => $version->notes,
                'conditions' => $version->conditions,
                'items' => $rows,
            ], (int) $quote->lock_version, $actor);

            $after = DB::table('quote_versions')->where('id', $quote->current_version_id)->value('grand_total');
            $summary = collect($moves)->map(fn (string $date, int $line): string => "línea {$line} al ".Carbon::parse($date)->format('d/m/Y'))->implode(', ');
            $this->audit->log('Cotización', $code, 'editar_version',
                $before === null ? null : Decimal::display((string) $before->grand_total, (string) $before->currency),
                Decimal::display((string) $after, (string) $version->currency)." · fecha alternativa: {$summary}");

            return (int) $quote->current_version_no;
        });
    }

    private function row(object $item, ?string $moved): array
    {
        $date = $moved ?? (string) $item->service_date;
        $manual = $item->price_source === 'manual';
        $row = ['product_code' => $item->product_code, 'date' => $date, 'qty' => (int) $item->qty, 'pax' => (int) $item->pax, 'segment' => $item->segment];

        if ($item->rate_id === null) {
            return [...$row, 'rate_id' => null, 'unit_price' => (string) $item->unit_price, 'unit_cost' => (string) $item->unit_cost];
        }

        $rate = DB::table('catalog_rates')->where('id', $item->rate_id)->first(['status', 'valid_from', 'valid_to']);
        $keep = $rate !== null && LineRates::valid($rate, $date);

        return [
            ...$row,
            ...($keep ? ['rate_id' => (string) $item->rate_id] : []),
            ...($manual ? ['unit_price' => (string) $item->unit_price] : []),
            ...($moved === null ? ['unit_cost' => (string) $item->unit_cost] : []),
        ];
    }
}
