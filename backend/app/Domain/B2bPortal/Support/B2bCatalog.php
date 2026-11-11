<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Support;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Support\SiteAvailability;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class B2bCatalog
{
    private const HORIZON = 400;

    private const LOOKAHEAD = 90;

    private ?Collection $products = null;

    public function __construct(
        private readonly SiteAvailability $availability,
        private readonly Consolidation $money,
    ) {}

    public function products(B2bAccount $account): Collection
    {
        if ($this->products !== null) {
            return $this->products;
        }

        $rows = DB::table('catalog_products as p')
            ->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->leftJoin('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->leftJoin('catalog_product_b2b_rates as r', fn ($join) => $join->on('r.product_id', '=', 'p.id')->where('r.agency_id', '=', $account->agency->id)->whereNull('r.deleted_at'))
            ->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')->where('p.is_b2b', true)
            ->whereExists(fn ($query) => $query->from('catalog_product_channels as ch')->whereColumn('ch.product_id', 'p.id')->where('ch.channel', 'b2b')->where('ch.is_published', true))
            ->orderBy('p.name')
            ->get([
                'p.id', 'p.code', 'p.name', 'p.short_description', 'p.long_description', 'p.duration_value', 'p.duration_unit', 'p.modality',
                'p.minimum_passengers', 'p.maximum_passengers', 'p.minimum_age', 'p.booking_advance_min_days', 'p.booking_advance_max_days',
                'p.operating_weekdays', 'p.availability_model', 'p.main_provider_id', 't.name as type_name', 'd.name as destination',
                'r.price as net', 'r.currency', 'r.commission_pct', 'r.is_credit', 'r.valid_to as rate_valid_to', 'r.conditions', 'r.restrictions',
            ]);

        $ids = $rows->pluck('id')->all();
        $this->availability->load($ids, $account->today, Carbon::parse($account->today)->addDays(self::HORIZON)->toDateString());
        $images = DB::table('catalog_product_media')->whereIn('product_id', $ids)->orderByDesc('is_main')->orderBy('sort_order')->get(['product_id', 'storage_path'])->groupBy('product_id');

        return $this->products = $rows->map(function (stdClass $row) use ($images, $account): stdClass {
            $row->image = $images->get($row->id)?->first()?->storage_path;
            $row->days = $row->duration_unit === 'días' ? max(1, (int) ceil((float) $row->duration_value)) : 1;
            $row->reason = $this->reason($row, $account);

            return $row;
        })->sortBy(fn (stdClass $row): string => ($row->reason === null ? '0' : '1').$row->name)->values();
    }

    public function product(B2bAccount $account, string $code): stdClass
    {
        return $this->products($account)->firstWhere('code', $code) ?? throw ApiException::notFound('Este producto no está en el catálogo de tu agencia.');
    }

    public function card(B2bAccount $account, stdClass $row): array
    {
        $today = Carbon::parse($account->today);
        $next = null;

        for ($i = 0; $i <= self::LOOKAHEAD && $row->reason === null; $i++) {
            $date = $today->copy()->addDays($i)->toDateString();
            $day = $this->day($row, $date, max(1, (int) $row->minimum_passengers), $today);

            if ($this->availability->sellable($day)) {
                $next = $day;
                break;
            }
        }

        $pvp = $next ? $this->pvp($next, (string) $row->currency) : null;
        $net = $row->net !== null ? Decimal::round2((string) $row->net) : null;

        return [
            'code' => $row->code,
            'name' => $row->name,
            'summary' => $row->short_description,
            'type' => $row->type_name,
            'destination' => $row->destination,
            'image' => $row->image,
            'duration' => $this->duration($row),
            'days' => $row->days,
            'pax' => ['min' => (int) $row->minimum_passengers, 'max' => (int) $row->maximum_passengers],
            'advance_days' => (int) $row->booking_advance_min_days,
            'model' => $row->availability_model,
            'bookable' => $row->reason === null,
            'reason' => $row->reason,
            'currency' => $row->currency,
            'net' => $net === null ? null : (string) $net,
            'pvp' => isset($pvp['adult']) ? (string) $pvp['adult'] : null,
            'commission_pct' => $row->commission_pct !== null ? (float) $row->commission_pct : null,
            'commission' => $net !== null ? (string) self::percent($net, (string) ($row->commission_pct ?? '0')) : null,
            'credit' => (bool) $row->is_credit && $account->creditBlock() === null,
            'rate_valid_to' => $row->rate_valid_to,
            'next_date' => $next['date'] ?? null,
            'departures' => $this->availability->usesDepartures($row->id)
                ? $this->availability->departures($row->id)
                    ->filter(fn (stdClass $departure): bool => $departure->departure_date >= $today->copy()->addDays((int) $row->booking_advance_min_days)->toDateString() && $departure->status === 'abierta')
                    ->take(3)
                    ->map(fn (stdClass $departure): array => ['date' => $departure->departure_date, 'spots' => $this->availability->free($departure)])
                    ->values()->all()
                : [],
        ];
    }

    public function departures(B2bAccount $account, stdClass $row): array
    {
        $today = Carbon::parse($account->today);
        $earliest = $today->copy()->addDays((int) $row->booking_advance_min_days)->toDateString();
        $items = [];

        foreach ($this->availability->departures($row->id) as $departure) {
            if ($departure->departure_date < $today->toDateString() || $departure->status === 'cancelada') {
                continue;
            }

            $items[] = [
                'date' => $departure->departure_date,
                'status' => $departure->status,
                'spots' => $this->availability->free($departure),
                'guaranteed' => (int) $departure->sold >= max(2, (int) $row->minimum_passengers),
                'outside_advance' => $departure->departure_date < $earliest,
                'bookable' => $row->reason === null && $departure->status === 'abierta' && $departure->departure_date >= $earliest && $this->availability->free($departure) > 0,
            ];
        }

        return ['product' => $row->code ?? null, 'advance_days' => (int) $row->booking_advance_min_days, 'earliest' => $earliest, 'uses_departures' => $this->availability->usesDepartures($row->id), 'items' => $items];
    }

    public function detail(B2bAccount $account, stdClass $row, string $month, int $seats): array
    {
        $today = Carbon::parse($account->today);
        $start = Carbon::parse($month.'-01')->startOfMonth();
        $days = [];

        for ($date = $start->copy(); $date->month === $start->month; $date->addDay()) {
            $day = $row->reason === null ? $this->day($row, $date->toDateString(), $seats, $today) : ['status' => 'cerrado', 'spots' => null, 'note' => $row->reason, 'price' => null, 'departure' => null];
            $pvp = $this->pvp($day, (string) $row->currency);
            $days[] = [
                'date' => $date->toDateString(),
                'status' => $day['status'],
                'label' => SiteAvailability::LABELS[$day['status']] ?? $day['status'],
                'spots' => $day['spots'],
                'note' => $day['note'],
                'pvp' => isset($pvp['adult']) ? (string) $pvp['adult'] : null,
                'sellable' => $this->availability->sellable($day),
            ];
        }

        $policies = DB::table('catalog_product_policies')->where('product_id', $row->id)->first(['cancellation', 'modification', 'no_show']);

        return [
            ...$this->card($account, $row),
            'description' => $row->long_description,
            'conditions' => $row->conditions,
            'restrictions' => $row->restrictions,
            'min_age' => $row->minimum_age !== null ? (int) $row->minimum_age : null,
            'policies' => $policies ? array_filter(['cancellation' => $policies->cancellation, 'modification' => $policies->modification, 'no_show' => $policies->no_show]) : [],
            'month' => $start->format('Y-m'),
            'seats' => $seats,
            'calendar' => $days,
        ];
    }

    public function price(B2bAccount $account, stdClass $row, string $date, int $adults, int $children): array
    {
        $seats = $adults + $children;
        $errors = [];

        if ($row->reason !== null) {
            $errors[] = $row->reason;
        }

        if ($adults < 1) {
            $errors[] = 'Incluye al menos un adulto.';
        }

        if ($seats < (int) $row->minimum_passengers) {
            $errors[] = "Este producto sale desde {$row->minimum_passengers} pasajeros.";
        }

        if ($seats > (int) $row->maximum_passengers) {
            $errors[] = "El máximo por reserva es {$row->maximum_passengers} pasajeros.";
        }

        $day = $this->day($row, $date, max(1, $seats), Carbon::parse($account->today));

        if (! $this->availability->sellable($day)) {
            $errors[] = $day['note'] ?? 'Sin disponibilidad para esa fecha: '.mb_strtolower(SiteAvailability::LABELS[$day['status']] ?? $day['status']).'. Elige otra fecha.';
        }

        $currency = (string) ($row->currency ?? 'USD');
        $net = Decimal::round2((string) ($row->net ?? '0'));
        $netTotal = $net->multipliedBy($seats);
        $pct = (float) $row->commission_pct;
        $pvp = $this->pvp($day, $currency);
        $pvpTotal = $pvp && $row->net !== null ? $pvp['adult']->multipliedBy($adults)->plus($pvp['child']->multipliedBy($children)) : null;
        $creditCurrency = (string) $account->agency->credit_currency;
        $inCredit = $this->convert($netTotal, $currency, $creditCurrency);
        $available = BigDecimal::max(BigDecimal::zero(), BigDecimal::of((string) $account->agency->credit_limit)->minus((string) $account->agency->credit_used))->toScale(2);
        $creditReason = match (true) {
            ! (bool) $row->is_credit => 'Este producto se vende solo con prepago.',
            $account->creditBlock() !== null => $account->creditBlock(),
            $inCredit->isGreaterThan($available) => 'Crédito insuficiente: la reserva suma '.number_format($inCredit->toFloat(), 2).' '.$creditCurrency.' y tu disponible es '.number_format($available->toFloat(), 2).' '.$creditCurrency.'. Cambia a prepago.',
            default => null,
        };
        $departure = $day['departure'] ?? null;

        return [
            'product' => $row->code,
            'name' => $row->name,
            'date' => $date,
            'end' => Carbon::parse($date)->addDays($row->days - 1)->toDateString(),
            'adults' => $adults,
            'children' => $children,
            'seats' => $seats,
            'currency' => $currency,
            'net_unit' => (string) $net,
            'net_total' => (string) $netTotal,
            'commission_pct' => $pct,
            'commission' => (string) self::percent($netTotal, (string) ($row->commission_pct ?? '0')),
            'pvp_total' => $pvpTotal === null ? null : (string) $pvpTotal,
            'margin' => $pvpTotal !== null ? (string) $pvpTotal->minus($netTotal) : null,
            'fx' => $this->money->usdRate(),
            'credit' => [
                'currency' => $creditCurrency,
                'amount' => (string) $inCredit,
                'available' => (string) $available,
                'after' => (string) $available->minus($inCredit),
                'allowed' => $creditReason === null,
                'reason' => $creditReason,
            ],
            'availability' => [
                'status' => $day['status'],
                'label' => SiteAvailability::LABELS[$day['status']] ?? $day['status'],
                'spots' => $day['spots'],
                'departure' => $departure ? ['ref' => $departure['ref'], 'time' => $departure['time'], 'meeting_point' => $departure['meeting_point']] : null,
            ],
            'outcome' => [
                'credito' => $departure ? 'confirmada' : 'pendiente_proveedor',
                'prepago' => 'pendiente_pago',
            ],
            'errors' => array_values(array_unique($errors)),
            'ok' => $errors === [],
        ];
    }

    public function convert(BigDecimal|string $amount, string $from, string $to): BigDecimal
    {
        return Decimal::round2(Decimal::convert($amount, $from, $to, number_format($this->money->usdRate(), 6, '.', '')));
    }

    private static function percent(BigDecimal $amount, string $pct): BigDecimal
    {
        return Decimal::round2($amount->multipliedBy($pct)->dividedBy(100, 6, RoundingMode::HALF_UP));
    }

    private function day(stdClass $row, string $date, int $seats, Carbon $today): array
    {
        $day = $this->availability->day($row, $date, $seats, $today);

        if ($day['status'] !== 'sin_tarifa') {
            return $day;
        }

        $spots = $day['spots'];

        return [...$day, 'note' => null, 'status' => match (true) {
            $spots === null => 'disponible',
            $spots <= 0 => 'agotado',
            $spots < $seats => 'sin_cupo',
            $spots <= 4 => 'pocos',
            default => 'disponible',
        }];
    }

    private function pvp(array $day, string $currency): ?array
    {
        $price = $day['price'] ?? null;

        if ($price === null) {
            return null;
        }

        $adult = $this->convert(number_format((float) ($price['list'] ?? $price['adult']), 2, '.', ''), (string) $price['currency'], $currency);

        return ['adult' => $adult, 'child' => $this->convert(number_format((float) $price['child'], 2, '.', ''), (string) $price['currency'], $currency)];
    }

    private function reason(stdClass $row, B2bAccount $account): ?string
    {
        return match (true) {
            $row->net === null => 'Sin tarifa B2B asignada a tu lista de precios.',
            $row->rate_valid_to !== null && $row->rate_valid_to < $account->today => 'Tarifa B2B vencida el '.Carbon::parse($row->rate_valid_to)->format('d/m/Y').'.',
            default => $account->bookingBlock(),
        };
    }

    private function duration(stdClass $row): string
    {
        $value = rtrim(rtrim((string) $row->duration_value, '0'), '.');

        return match ($row->duration_unit) {
            'horas' => "{$value} h",
            'días' => $value === '1' ? '1 día' : "{$value} días",
            default => trim("{$value} {$row->duration_unit}"),
        };
    }
}
