<?php

declare(strict_types=1);

namespace App\Domain\Booking;

use App\Domain\Booking\Contracts\BookingEngineInterface;
use App\Domain\Booking\Contracts\InventoryReader;
use App\Domain\Booking\Data\BookingQuote;
use App\Domain\Booking\Data\DayStatus;
use App\Domain\Booking\Data\FxTable;
use App\Domain\Booking\Data\PaxValidation;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteLine;
use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Booking\Data\SeasonCalendar;
use App\Domain\Catalog\Support\RateResolver;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Carbon\CarbonImmutable;
use Closure;
use DomainException;

final class BookingEngine implements BookingEngineInterface
{
    private const MAX_SEARCH_DAYS = 400;

    private readonly CarbonImmutable $today;

    public function __construct(
        private readonly RuleSet $rules,
        private readonly FxTable $fx,
        private readonly SeasonCalendar $seasons,
        private readonly InventoryReader $inventory,
        private readonly array $ecommerceDefaults,
        string $today,
        private readonly ?Closure $rounding = null,
    ) {
        $this->today = CarbonImmutable::parse($today)->startOfDay();
    }

    public function dayStatus(ProductData $p, string $date, int $seats = 0): DayStatus
    {
        $ranges = $this->rules->on('R-AVAIL-RANGES', $p) ? $p->ranges : null;
        $day = CarbonImmutable::parse($date)->startOfDay();

        if ($day->lt($this->today)) {
            return new DayStatus('pasado', 'Fecha pasada', 0);
        }
        $dep = $p->departures[$date] ?? null;

        $cutoffH = $this->rules->on('R-CUTOFF', $p)
            ? ($p->cutoffHours ?: ($p->advanceMinDays * 24 ?: (int) $this->rules->param('R-CUTOFF', 'defaultHours', $p)))
            : 0;
        if ($cutoffH > 0 && (int) $this->today->diffInDays($day) * 24 < $cutoffH) {
            return new DayStatus('fuera_de_plazo', 'Reserva con '.(int) ceil($cutoffH / 24).' día(s) de anticipación', 0);
        }
        if ($p->operatingWeekdays !== null && $this->rules->on('R-WEEKDAYS', $p) && ! in_array($day->dayOfWeek, $p->operatingWeekdays, true)) {
            return new DayStatus('no_opera', 'No opera este día', 0);
        }

        if (($ranges === null || $ranges === []) && $dep === null) {
            return $p->hasAvailabilityConfig && ! $this->rules->on('R-AVAIL-RANGES', $p)
                ? new DayStatus('disponible', 'Disponible', null)
                : new DayStatus('sin_configurar', 'Consultar', null);
        }

        $range = null;
        if ($ranges) {
            $hits = array_values(array_filter($ranges, fn (array $r) => $date >= $r['from'] && $date <= $r['to']));
            foreach ($hits as $h) {
                if ($h['status'] !== 'disponible') {
                    $range = $h;
                    break;
                }
            }
            $range ??= $hits[0] ?? null;
        }
        if ($range !== null && $range['status'] === 'cerrado') {
            return new DayStatus('cerrado', 'Ocupado / cerrado', 0, null, $range['note'], $range);
        }
        if ($range !== null && $range['status'] === 'agotado') {
            return new DayStatus('agotado', 'Agotado', 0, null, $range['note'], $range);
        }

        $cap = $dep !== null ? $dep['capacity'] : ($range['capacity_per_day'] ?? null);
        if ($cap === null) {
            return $ranges ? new DayStatus('cerrado', 'Sin salida programada', 0) : new DayStatus('sin_configurar', 'Consultar', 0);
        }

        $sold = $dep !== null ? $dep['sold'] : $this->inventory->soldOn($p->id, $date);
        $held = $this->inventory->heldOn($p->id, $date);
        $left = max(0, $cap - $sold - $held);

        if ($left <= 0) {
            return new DayStatus('agotado', 'Agotado', 0, $cap, null, $range);
        }
        if ($seats > 0 && $left < $seats) {
            return new DayStatus('sin_cupo', 'Quedan '.$left.' cupo(s)', $left, $cap, null, $range);
        }

        return new DayStatus('disponible', $left <= 4 ? 'Últimos '.$left.' cupos' : 'Disponible', $left, $cap, null, $range, $dep['ref'] ?? null);
    }

    public function month(ProductData $p, int $year, int $month, int $seats = 0): array
    {
        $out = [];
        $d = CarbonImmutable::create($year, $month, 1);
        while ($d->month === $month) {
            $out[] = ['date' => $d->toDateString(), 'status' => $this->dayStatus($p, $d->toDateString(), $seats)];
            $d = $d->addDay();
        }

        return $out;
    }

    public function nextAvailable(ProductData $p, int $seats, ?string $from = null): ?string
    {
        $d = $from !== null ? CarbonImmutable::parse($from) : $this->today;
        for ($i = 0; $i < self::MAX_SEARCH_DAYS; $i++, $d = $d->addDay()) {
            if ($this->dayStatus($p, $d->toDateString(), $seats)->status === 'disponible') {
                return $d->toDateString();
            }
        }

        return null;
    }

    public function paxRules(ProductData $p): array
    {
        $r = ['infantAllowed' => true, ...$this->camel((array) ($this->ecommerceDefaults['defaultPaxRules'] ?? [])), ...$this->camel($p->paxRules)];

        if (! $this->rules->on('R-CHILD-PER-ADULT', $p)) {
            $r['maxChildrenPerAdult'] = 99;
            $r['childPricePct'] = 100;
        }
        if (! $this->rules->on('R-INFANT-FREE', $p)) {
            $r['maxInfantsPerAdult'] = 99;
            $r['infantPays'] = true;
        }
        if (! $this->rules->on('R-MIN-ADULTS', $p)) {
            $r['minAdults'] = 0;
        }

        return $r;
    }

    public function ageType(ProductData $p, ?int $age): string
    {
        $r = $this->paxRules($p);

        return match (true) {
            $age === null => 'ADT',
            $age >= (int) $r['adultMinAge'] => 'ADT',
            $age >= (int) $r['childMinAge'] && $age <= (int) $r['childMaxAge'] => 'CHD',
            $age <= (int) $r['infantMaxAge'] => 'INF',
            default => 'NA',
        };
    }

    public function validatePax(ProductData $p, array $pax): PaxValidation
    {
        $r = $this->paxRules($p);
        $adt = (int) ($pax['adt'] ?? 0);
        $chd = (int) ($pax['chd'] ?? 0);
        $inf = (int) ($pax['inf'] ?? 0);
        $e = [];

        if (! empty($r['minAdults']) && $adt < (int) $r['minAdults']) {
            $e[] = 'Se requiere al menos '.((int) $r['minAdults'] ?: 1).' adulto(s) ('.$r['adultMinAge'].'+ años).';
        }
        if ($chd > $adt * (int) $r['maxChildrenPerAdult']) {
            $e[] = 'Máximo '.$r['maxChildrenPerAdult'].' niño(s) de '.$r['childMinAge'].' a '.$r['childMaxAge'].' años por cada adulto.';
        }
        if ($inf > 0 && ($r['infantAllowed'] ?? true) === false) {
            $e[] = 'Este servicio no admite infantes (menores de '.$r['childMinAge'].' años).';
        } elseif ($inf > $adt * (int) $r['maxInfantsPerAdult']) {
            $e[] = 'Máximo '.$r['maxInfantsPerAdult'].' infante(s) de 0 a '.$r['infantMaxAge'].' años por cada adulto.';
        }
        $seats = $adt + $chd + (! empty($r['infantPays']) ? $inf : 0);
        if ($this->rules->on('R-MAX-PAX', $p) && $p->maxPax !== null && $seats > $p->maxPax) {
            $e[] = 'Máximo '.$p->maxPax.' pasajeros por reserva.';
        }

        return new PaxValidation($e === [], $e, $seats);
    }

    public function quote(ProductData $p, QuoteSelection $sel): BookingQuote
    {
        $currency = $sel->currency;
        if ($currency !== $this->fx->base() && ! $this->rules->on('R-MULTICURRENCY')) {
            throw new DomainException('R-MULTICURRENCY');
        }

        $warnings = $this->validatePax($p, $sel->pax)->errors;
        $season = ($sel->date !== null && $this->rules->on('R-SEASON', $p)) ? $this->seasons->for($sel->date) : null;
        $factor = BigDecimal::of($season->factor ?? '1');

        $schedule = $this->tripSchedule($p, $sel);
        foreach ($schedule as $leg) {
            if ($leg['requested'] !== null && $leg['requested'] !== $leg['nights']) {
                $warnings[] = $leg['city'].' admite de '.$leg['minNights'].' a '.$leg['maxNights'].' noche(s): se ajustó a '.$leg['nights'].'.';
            }
        }

        [$lines, $rooms, $nights] = $this->priceLines($p, $sel, $factor, $season, $warnings, $schedule);

        $subtotal = $this->sum($currency, array_filter($lines, fn (QuoteLine $l): bool => ! $l->removed && $l->kind !== 'info'));
        $adjustments = $this->adjustments($p, $sel, $subtotal);
        $total = $subtotal;
        foreach ($adjustments as $a) {
            $total = $total->plus($a['amount']);
        }

        [$mode, $modes, $pct, $holdHours, $dueDays] = $this->paymentPlan($p, $sel);
        $deposit = $total->multipliedBy(BigDecimal::of($pct)->dividedBy(100, 4), RoundingMode::HALF_UP);
        $balance = $total->minus($deposit);
        $balanceDue = null;
        if ($sel->date !== null && $mode !== 'total') {
            $balanceDue = CarbonImmutable::parse($sel->date)->startOfDay()->subDays($dueDays);
            if ($balanceDue->lt($this->today)) {
                $balanceDue = $this->today;
                $warnings[] = 'La salida es cercana: el saldo se cobra de inmediato.';
            }
        }

        return new BookingQuote(
            currency: $currency,
            lines: $lines,
            adjustments: $adjustments,
            subtotal: $subtotal,
            total: $total,
            paymentMode: $mode,
            modes: $modes,
            depositPct: $pct,
            deposit: $deposit,
            balance: $balance,
            balanceDue: $balanceDue,
            holdHours: $holdHours,
            rooms: $rooms,
            nights: $nights,
            warnings: $warnings,
            ok: $this->onlyNonBlocking($warnings),
            season: $season,
            legs: array_map(fn (array $leg): array => array_diff_key($leg, ['requested' => true]), $schedule),
            tripEnd: $schedule === [] ? null : $schedule[count($schedule) - 1]['checkOut'],
            byCategory: $this->byCategory($currency, $lines),
        );
    }

    public function tripSchedule(ProductData $p, QuoteSelection $sel): array
    {
        $on = $this->rules->on('R-TRIP-BUILDER', $p);
        $day = $sel->date !== null ? CarbonImmutable::parse($sel->date)->startOfDay() : null;
        $out = [];

        foreach (array_values((array) ($p->accommodation['legs'] ?? [])) as $leg) {
            $fixed = (int) $leg['nights'];
            $min = $on && ! empty($leg['minNights']) ? (int) $leg['minNights'] : $fixed;
            $max = $on && ! empty($leg['maxNights']) ? (int) $leg['maxNights'] : $fixed;
            $requested = $on && array_key_exists((string) $leg['id'], $sel->nights) ? (int) $sel->nights[(string) $leg['id']] : null;
            $nights = $requested === null ? $fixed : max($min, min($max, $requested));
            $out[] = [
                'legId' => (string) $leg['id'],
                'city' => (string) $leg['city'],
                'nights' => $nights,
                'minNights' => $min,
                'maxNights' => $max,
                'requested' => $requested,
                'checkIn' => $day?->toDateString(),
                'checkOut' => $day?->addDays($nights)->toDateString(),
            ];
            $day = $day?->addDays($nights);
        }

        return $out;
    }

    public function vehicleFor(array $vehicles, int $people): ?array
    {
        $sorted = collect($vehicles)->sortBy(fn (array $v): int => (int) $v['maxPax'])->values();
        if ($sorted->isEmpty()) {
            return null;
        }
        $fit = $sorted->first(fn (array $v): bool => (int) $v['maxPax'] >= $people);
        $vehicle = $fit ?? $sorted->last();

        return ['vehicle' => $vehicle, 'units' => $fit !== null ? 1 : (int) ceil(max(1, $people) / max(1, (int) $vehicle['maxPax']))];
    }

    public function tripItemAmount(array $item, string $kind, array $pax): array
    {
        $adt = (int) ($pax['adt'] ?? 0);
        $chd = (int) ($pax['chd'] ?? 0);

        if ($kind === 'tour') {
            $children = BigDecimal::of((string) ($item['priceChd'] ?? 0))->isPositive() || empty($item['minAge']) ? $chd : 0;
            $amount = BigDecimal::of((string) $item['priceAdt'])->multipliedBy($adt)->plus(BigDecimal::of((string) ($item['priceChd'] ?? 0))->multipliedBy($children));

            return ['amount' => $amount, 'adt' => $adt, 'chd' => $children, 'vehicle' => null, 'units' => null];
        }

        if (($item['pricing'] ?? 'pax') === 'vehiculo') {
            $pick = $this->vehicleFor((array) ($item['vehicles'] ?? []), $adt + $chd);
            if ($pick === null) {
                return ['amount' => BigDecimal::zero(), 'adt' => $adt, 'chd' => $chd, 'vehicle' => null, 'units' => null];
            }

            return ['amount' => BigDecimal::of((string) $pick['vehicle']['price'])->multipliedBy($pick['units']), 'adt' => $adt, 'chd' => $chd, 'vehicle' => $pick['vehicle'], 'units' => $pick['units']];
        }

        $child = BigDecimal::of((string) ($item['priceChd'] ?? 0));
        $child = $child->isPositive() ? $child : BigDecimal::of((string) $item['priceAdt']);

        return ['amount' => BigDecimal::of((string) $item['priceAdt'])->multipliedBy($adt)->plus($child->multipliedBy($chd)), 'adt' => $adt, 'chd' => $chd, 'vehicle' => null, 'units' => null];
    }

    public function tourDate(array $tour, array $leg): ?string
    {
        if (($leg['checkIn'] ?? null) === null) {
            return null;
        }

        return CarbonImmutable::parse($leg['checkIn'])->addDays(min((int) ($tour['dayOffset'] ?? 0), max(0, (int) $leg['nights'] - 1)))->toDateString();
    }

    public function transportDate(array $option, array $schedule): ?string
    {
        $legs = collect($schedule)->keyBy('legId');
        $to = ($option['toLegId'] ?? null) !== null ? $legs->get($option['toLegId']) : null;

        return $to !== null ? $to['checkIn'] : ($legs->get($option['fromLegId'])['checkIn'] ?? null);
    }

    public function pickTransport(ProductData $p, array $ids): array
    {
        $options = collect($p->trip['transport'] ?? [])->keyBy('id');
        $picked = [];
        foreach ($ids as $id) {
            $option = $options->get($id);
            if ($option === null) {
                continue;
            }
            $picked[($option['toLegId'] ?? null) === null ? 'local|'.$option['id'] : $option['fromLegId'].'|'.$option['toLegId']] = $option;
        }

        return array_values($picked);
    }

    private function tripLines(ProductData $p, QuoteSelection $sel, array $schedule, callable $add, array &$warnings, string $fallbackCurrency): void
    {
        $legs = collect($schedule)->keyBy('legId');
        $currency = (string) ($p->trip['currency'] ?? $fallbackCurrency);
        $tours = collect($p->trip['tours'] ?? [])->keyBy('id');

        foreach (array_unique($sel->tours) as $id) {
            $tour = $tours->get($id);
            if ($tour === null) {
                continue;
            }
            $leg = $legs->get($tour['legId'], []);
            $priced = $this->tripItemAmount($tour, 'tour', $sel->pax);
            if (! empty($tour['minAge']) && $sel->pax['chd'] > 0) {
                $warnings[] = $tour['name'].': edad mínima '.$tour['minAge'].' años; los niños menores no participan.';
            }
            $date = $this->tourDate($tour, $leg);
            $add('tour-'.$tour['id'], 'tour', (isset($leg['city']) ? $leg['city'].' · ' : '').$tour['name'].($date !== null ? ' · '.substr($date, 8, 2).'/'.substr($date, 5, 2).' '.$tour['time'] : ''), 1, $priced['amount'], (string) ($tour['currency'] ?? $currency), true,
                ['tour_id' => $tour['id'], 'leg_id' => $tour['legId'], 'city' => $leg['city'] ?? null, 'date' => $date, 'time' => $tour['time'] ?? null, 'adt' => $priced['adt'], 'chd' => $priced['chd'], 'provider_id' => $tour['providerId'] ?? null]);
        }

        foreach ($this->pickTransport($p, $sel->transport) as $option) {
            $priced = $this->tripItemAmount($option, 'transport', $sel->pax);
            $date = $this->transportDate($option, $schedule);
            $vehicle = $priced['vehicle'] !== null ? ' · '.($priced['units'] > 1 ? $priced['units'].' × ' : '').$priced['vehicle']['name'] : '';
            $add('trans-'.$option['id'], 'transport', $option['name'].$vehicle.($date !== null ? ' · '.substr($date, 8, 2).'/'.substr($date, 5, 2) : ''), 1, $priced['amount'], (string) ($option['currency'] ?? $currency), true,
                ['transport_id' => $option['id'], 'mode' => $option['mode'] ?? $option['kind'] ?? null, 'from_leg_id' => $option['fromLegId'], 'to_leg_id' => $option['toLegId'] ?? null, 'date' => $date, 'pricing' => $option['pricing'] ?? 'pax', 'vehicle' => $priced['vehicle']['name'] ?? null, 'units' => $priced['units'], 'adt' => $priced['adt'], 'chd' => $priced['chd'], 'provider_id' => $option['providerId'] ?? null]);
        }
    }

    private function byCategory(string $currency, array $lines): array
    {
        $out = [];
        foreach (['base', 'lodging', 'tour', 'transport', 'addon', 'surcharge'] as $kind) {
            $out[$kind] = Money::zero($currency);
        }
        foreach ($lines as $line) {
            if (! $line->removed && isset($out[$line->kind])) {
                $out[$line->kind] = $out[$line->kind]->plus($line->amount);
            }
        }

        return $out;
    }

    public function segmentPrice(ProductData $p, string $segment, string $date, string $currency, string $channel = 'Directo'): ?array
    {
        $season = $this->rules->on('R-SEASON', $p) ? $this->seasons->for($date) : null;
        $rate = $this->baseRate($p, $segment, $channel, $season);

        if ($rate === null && $segment === 'Adulto') {
            $rate = $this->baseRate($p, 'Pasajero', $channel, $season);
        }

        if ($rate === null && $segment === 'Niño') {
            $adult = $this->segmentPrice($p, 'Adulto', $date, $currency, $channel);
            $pct = (string) ($this->paxRules($p)['childPricePct'] ?? 100);

            return $adult === null ? null : [
                'price' => $adult['price']->multipliedBy(BigDecimal::of($pct)->dividedBy(100, 6), RoundingMode::HALF_UP),
                'cost' => $adult['cost'],
                'source' => 'child_pct',
            ];
        }

        if ($rate === null) {
            return null;
        }

        $from = (string) $rate['currency'];
        $marginPct = $this->rules->on('R-MULTICURRENCY') ? (string) ($this->rules->param('R-MULTICURRENCY', 'fxMarginPct') ?? 0) : '0';

        return [
            'price' => Money::of($this->fx->display(RateResolver::seasonal($rate, $season?->factor), $from, $currency, $marginPct), $currency, null, RoundingMode::HALF_UP),
            'cost' => Money::of($this->fx->convert(BigDecimal::of((string) ($rate['cost'] ?? 0)), $from, $currency), $currency, null, RoundingMode::HALF_UP),
            'source' => 'rate',
        ];
    }

    private function baseRate(ProductData $p, string $segment, string $channel, ?object $season = null): ?array
    {
        $rate = RateResolver::pick($p->rates, null, [$segment], $channel, $season?->id);

        return is_array($rate) ? $rate : null;
    }

    private function priceLines(ProductData $p, QuoteSelection $sel, BigDecimal $factor, ?object $season, array &$warnings, array $schedule = []): array
    {
        $r = $this->paxRules($p);
        $pax = $sel->pax;
        $currency = $sel->currency;
        $adtRate = $this->baseRate($p, 'Adulto', $sel->channel, $season) ?? $this->baseRate($p, 'Pasajero', $sel->channel, $season);
        if ($adtRate === null) {
            $warnings[] = 'El producto no tiene tarifa vigente (PRD-BR-005).';
        }
        $rateCurrency = (string) ($adtRate['currency'] ?? $this->fx->base());
        $chdRate = $this->baseRate($p, 'Niño', $sel->channel, $season);
        $optionDelta = $this->optionDelta($p, $sel);

        $round = fn (BigDecimal $unit): BigDecimal => $sel->roundUnits && $this->rounding !== null ? ($this->rounding)($unit) : $unit;
        $adtUnit = $adtRate !== null ? $round(RateResolver::base($adtRate)->multipliedBy($factor))->plus($optionDelta->multipliedBy($factor)) : BigDecimal::zero();
        $chdUnit = ! empty($r['childPays'])
            ? ($chdRate !== null
                ? $round(RateResolver::base($chdRate)->multipliedBy($factor))
                : $round($adtUnit->multipliedBy((string) ($r['childPricePct'] ?? 100))->dividedBy(100, 6, RoundingMode::HALF_UP)))
            : BigDecimal::zero();
        $infUnit = ! empty($r['infantPays']) ? $chdUnit : BigDecimal::zero();

        $canRemove = $this->rules->on('R-PREVIEW-REMOVE', $p);
        $marginPct = $this->rules->on('R-MULTICURRENCY') ? (string) ($this->rules->param('R-MULTICURRENCY', 'fxMarginPct') ?? 0) : '0';
        $lines = [];
        $add = function (string $key, string $kind, string $label, int $qty, BigDecimal $unit, string $from, bool $removable, array $meta = []) use (&$lines, $canRemove, $sel, $currency, $marginPct): QuoteLine {
            $removable = $removable && $canRemove;
            $line = new QuoteLine(
                key: $key,
                kind: $kind,
                label: $label,
                qty: $qty,
                unit: Money::of($this->fx->display($unit, $from, $currency, $marginPct), $currency, null, RoundingMode::HALF_UP),
                amount: Money::of($this->fx->display($unit->multipliedBy($qty), $from, $currency, $marginPct), $currency, null, RoundingMode::HALF_UP),
                removable: $removable,
                removed: $removable && in_array($key, $sel->removed, true),
                meta: $meta,
            );
            $lines[] = $line;

            return $line;
        };

        if ($pax['adt'] > 0) {
            $add('base-adt', 'base', 'Tour · adulto ('.$r['adultMinAge'].'+ años)', $pax['adt'], $adtUnit, $rateCurrency, false);
        }
        if ($pax['chd'] > 0) {
            $add('base-chd', 'base', 'Tour · niño ('.$r['childMinAge'].'–'.$r['childMaxAge'].' años)'.(! empty($r['childPays']) ? '' : ' · sin costo'), $pax['chd'], $chdUnit, $rateCurrency, false);
        }
        if ($pax['inf'] > 0) {
            $add('base-inf', 'base', 'Infante (0–'.$r['infantMaxAge'].' años)'.(! empty($r['infantPays']) ? '' : ' · no paga'), $pax['inf'], $infUnit, $rateCurrency, false);
        }
        if ($season !== null && ! $factor->isEqualTo(1)) {
            $zero = Money::zero($currency);
            $lines[] = new QuoteLine('season', 'info', 'Tarifa de '.$season->name.' (factor '.$factor->strippedOfTrailingZeros().')', 0, $zero, $zero);
        }

        if ($this->rules->on('R-ADDONS', $p)) {
            foreach ($sel->addons as $selected) {
                $addon = collect($p->addons)->firstWhere('id', $selected['id'] ?? null);
                $qty = (int) ($selected['qty'] ?? 0);
                if ($addon === null || $qty <= 0) {
                    continue;
                }
                $add('addon-'.$addon['id'], 'addon', (string) $addon['name'], $qty, BigDecimal::of((string) $addon['price']), (string) $addon['currency'], true, ['addon_id' => $addon['id'], 'category' => $addon['category'] ?? null]);
            }
        }

        [$rooms, $nights] = $this->rules->on('R-LODGING', $p) ? $this->lodgingLines($p, $sel, $add, $warnings, $schedule) : [0, 0];

        if ($this->rules->on('R-SINGLE-SUPP', $p)) {
            $pct = (string) ($this->rules->param('R-SINGLE-SUPP', 'pct', $p) ?? 0);
            foreach ($lines as $line) {
                if ($line->kind !== 'lodging' || ($line->meta['room_type'] ?? null) !== 'Simple' || $line->removed) {
                    continue;
                }
                $supplement = $line->amount->multipliedBy(BigDecimal::of($pct)->dividedBy(100, 6), RoundingMode::HALF_UP);
                $lines[] = new QuoteLine('supp-'.$line->key, 'surcharge', 'Suplemento habitación simple '.$line->meta['city'].' ('.$pct.' %)', 1, $supplement, $supplement);
            }
        }

        if ($this->rules->on('R-TRIP-BUILDER', $p)) {
            $this->tripLines($p, $sel, $schedule, $add, $warnings, $rateCurrency);
        }

        return [$lines, $rooms, $nights];
    }

    private function lodgingLines(ProductData $p, QuoteSelection $sel, callable $add, array &$warnings, array $schedule = []): array
    {
        $legs = collect($p->accommodation['legs'] ?? []);
        $plan = collect($schedule)->keyBy('legId');
        $seasonal = $this->rules->on('R-TRIP-BUILDER', $p);
        $lodgingCurrency = (string) ($p->accommodation['currency'] ?? 'USD');
        $need = $sel->pax['adt'] + $sel->pax['chd'];
        $rooms = 0;
        $nights = 0;

        foreach ($sel->lodging as $choice) {
            $leg = $legs->firstWhere('id', $choice['leg_id'] ?? $choice['legId'] ?? null);
            $hotel = $leg === null ? null : collect($leg['hotels'] ?? [])->firstWhere('id', $choice['hotel_id'] ?? $choice['hotelId'] ?? null);
            if ($hotel === null) {
                continue;
            }

            $stay = $plan->get((string) $leg['id']);
            $legNights = (int) ($stay['nights'] ?? $leg['nights']);
            $legRooms = 0;
            $legBeds = 0;
            foreach ((array) ($choice['rooms'] ?? []) as $room) {
                $type = collect($hotel['rooms'] ?? [])->firstWhere('type', $room['type'] ?? null);
                $qty = (int) ($room['qty'] ?? 0);
                if ($type === null || $qty <= 0) {
                    continue;
                }
                $legRooms += $qty;
                $legBeds += $qty * (int) $type['capacity'];
                [$unit, $hits] = $seasonal ? $this->nightlyRate($hotel, (string) $type['price'], $stay['checkIn'] ?? null, $legNights) : [BigDecimal::of((string) $type['price']), []];
                $add('lodge-'.$leg['id'].'-'.$type['type'], 'lodging',
                    $leg['city'].' · '.$hotel['name'].' · '.$qty.' hab. '.mb_strtolower((string) $type['type']).' × '.$legNights.' noche(s)'.($hits !== [] ? ' · '.implode(', ', $hits) : ''),
                    $qty * $legNights, $unit, $lodgingCurrency, true,
                    ['leg_id' => $leg['id'], 'city' => $leg['city'], 'hotel' => $hotel['name'], 'room_type' => $type['type'], 'rooms' => $qty, 'nights' => $legNights, 'check_in' => $stay['checkIn'] ?? null, 'check_out' => $stay['checkOut'] ?? null, 'seasonal' => $hits !== []]);
            }

            if ($this->rules->on('R-LODGING-CAPACITY', $p) && $legRooms > 0 && $legBeds < $need) {
                $warnings[] = $leg['city'].': las habitaciones elegidas alojan '.$legBeds.' persona(s) y el grupo necesita '.$need.' camas (los infantes comparten).';
            }

            $legRemoved = collect($sel->removed)->contains(fn (string $key): bool => str_starts_with($key, 'lodge-'.$leg['id']));
            if (! $legRemoved || ! $this->rules->on('R-PREVIEW-REMOVE', $p)) {
                $rooms += $legRooms;
                $nights += $legRooms > 0 ? $legNights : 0;
            }
        }

        return [$rooms, $nights];
    }

    private function nightlyRate(array $hotel, string $base, ?string $checkIn, int $nights): array
    {
        $price = BigDecimal::of($base);
        $ranges = (array) ($hotel['seasonRates'] ?? []);
        if ($checkIn === null || $nights <= 0 || $ranges === []) {
            return [$price, []];
        }

        $sum = BigDecimal::zero();
        $hits = [];
        $day = CarbonImmutable::parse($checkIn);
        for ($i = 0; $i < $nights; $i++, $day = $day->addDay()) {
            $date = $day->toDateString();
            $range = collect($ranges)->first(fn (array $r): bool => $date >= $r['from'] && $date <= $r['to']);
            if ($range === null) {
                $sum = $sum->plus($price);

                continue;
            }
            $pct = BigDecimal::of((string) $range['pct']);
            $sum = $sum->plus($price->multipliedBy(BigDecimal::of(100)->plus($pct))->dividedBy(100, 2, RoundingMode::HALF_UP));
            $hits[$range['label']] = $range['label'].' '.($pct->isNegative() ? '' : '+').$pct->strippedOfTrailingZeros().' %';
        }

        return [$sum->dividedBy($nights, 2, RoundingMode::HALF_UP), array_values($hits)];
    }

    private function optionDelta(ProductData $p, QuoteSelection $sel): BigDecimal
    {
        $delta = BigDecimal::zero();

        foreach ($sel->options as $selected) {
            $group = collect($p->options)->firstWhere('group', $selected['group'] ?? null);
            $option = $group === null ? null : collect($group['options'] ?? [])->firstWhere('label', $selected['label'] ?? null);
            $delta = $option === null ? $delta : $delta->plus((string) ($option['delta'] ?? 0));
        }

        return $delta;
    }

    private function adjustments(ProductData $p, QuoteSelection $sel, Money $subtotal): array
    {
        $r = $this->paxRules($p);
        $payers = $sel->pax['adt'] + (! empty($r['childPays']) ? $sel->pax['chd'] : 0);
        $days = $sel->date === null ? null : (int) $this->today->diffInDays(CarbonImmutable::parse($sel->date)->startOfDay(), false);
        $percent = fn (Money $base, string $pct): Money => $base->multipliedBy(BigDecimal::of($pct)->dividedBy(100, 6), RoundingMode::HALF_UP);
        $adjustments = [];

        if ($this->rules->on('R-GROUP-DISC', $p) && $payers >= (int) $this->rules->param('R-GROUP-DISC', 'fromPax', $p)) {
            $pct = (string) $this->rules->param('R-GROUP-DISC', 'pct', $p);
            $adjustments[] = ['key' => 'group', 'label' => 'Descuento de grupo ('.$pct.' %)', 'amount' => $percent($subtotal, $pct)->negated()];
        }
        if ($days !== null && $this->rules->on('R-EARLY-BIRD', $p) && $days >= (int) $this->rules->param('R-EARLY-BIRD', 'days', $p)) {
            $pct = (string) $this->rules->param('R-EARLY-BIRD', 'pct', $p);
            $adjustments[] = ['key' => 'early', 'label' => 'Reserva anticipada ('.$pct.' %)', 'amount' => $percent($subtotal, $pct)->negated()];
        }
        if ($days !== null && $this->rules->on('R-LAST-MINUTE', $p) && $days < (int) $this->rules->param('R-LAST-MINUTE', 'days', $p)) {
            $pct = (string) $this->rules->param('R-LAST-MINUTE', 'pct', $p);
            $adjustments[] = ['key' => 'last', 'label' => 'Recargo de última hora ('.$pct.' %)', 'amount' => $percent($subtotal, $pct)];
        }

        if ($sel->promotion !== null && $this->rules->on('R-PROMO', $p)) {
            $promo = $sel->promotion;
            $amount = ! empty($promo['percent'])
                ? $percent($subtotal, (string) $promo['value'])
                : Money::of($this->fx->display(BigDecimal::of((string) $promo['value']), (string) ($promo['currency'] ?? $sel->currency), $sel->currency, '0'), $sel->currency, null, RoundingMode::HALF_UP);
            if ($amount->isGreaterThan($subtotal)) {
                $amount = $subtotal;
            }
            if ($amount->isPositive()) {
                $adjustments[] = ['key' => 'promo', 'label' => (string) $promo['label'], 'amount' => $amount->negated(), 'code' => $promo['code'] ?? null];
            }
        }

        if ($this->rules->on('R-PAY-FEE', $p) && $sel->paymentMethod === 'tarjeta') {
            $running = $subtotal;
            foreach ($adjustments as $adjustment) {
                $running = $running->plus($adjustment['amount']);
            }
            $pct = (string) $this->rules->param('R-PAY-FEE', 'cardPct', $p);
            $adjustments[] = ['key' => 'fee', 'label' => 'Recargo por pago con tarjeta ('.$pct.' %)', 'amount' => $percent($running, $pct)];
        }

        return $adjustments;
    }

    private function paymentPlan(ProductData $p, QuoteSelection $sel): array
    {
        $payment = $p->payment;
        $modes = array_values((array) ($payment['modes'] ?? $this->ecommerceDefaults['paymentModes'] ?? ['total']));
        if (! $this->rules->on('R-DEPOSIT', $p)) {
            $modes = array_values(array_diff($modes, ['adelanto']));
        }
        if ($this->rules->on('R-PAY-LATER', $p) && ! in_array('pagar_despues', $modes, true)) {
            $modes[] = 'pagar_despues';
        }
        $modes = $modes ?: ['total'];

        $mode = in_array($sel->paymentMode, $modes, true) ? (string) $sel->paymentMode : $modes[0];

        $pct = match ($mode) {
            'adelanto' => (int) ($payment['depositPct'] ?? $this->rules->param('R-DEPOSIT', 'pct', $p) ?? $this->ecommerceDefaults['depositPctDefault'] ?? 30),
            'pagar_despues' => 0,
            default => 100,
        };
        $holdHours = $mode === 'pagar_despues' ? (int) $this->rules->param('R-PAY-LATER', 'holdHours', $p) : null;
        $dueDays = (int) ($payment['balanceDueDays'] ?? $this->rules->param('R-DEPOSIT', 'balanceDueDays', $p) ?? $this->ecommerceDefaults['balanceDueDaysDefault'] ?? 15);

        return [$mode, $modes, $pct, $holdHours, $dueDays];
    }

    private function sum(string $currency, iterable $lines): Money
    {
        $total = Money::zero($currency);
        foreach ($lines as $l) {
            $total = $total->plus($l->amount);
        }

        return $total;
    }

    private function onlyNonBlocking(array $warnings): bool
    {

        foreach ($warnings as $w) {
            if (str_starts_with($w, 'Se requiere') || str_starts_with($w, 'Máximo') || str_starts_with($w, 'Este servicio no admite') || str_contains($w, 'PRD-BR-005')) {
                return false;
            }
        }

        return true;
    }

    private function camel(array $rules): array
    {
        $out = [];
        foreach ($rules as $k => $v) {
            $out[lcfirst(str_replace('_', '', ucwords((string) $k, '_')))] = $v;
        }

        return $out;
    }
}
