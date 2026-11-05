<?php

declare(strict_types=1);

namespace App\Domain\Bookings;

use App\Domain\Bookings\Contracts\BookingEngineInterface;
use App\Domain\Bookings\Contracts\InventoryReader;
use App\Domain\Bookings\Data\BookingQuote;
use App\Domain\Bookings\Data\DayStatus;
use App\Domain\Bookings\Data\FxTable;
use App\Domain\Bookings\Data\PaxValidation;
use App\Domain\Bookings\Data\ProductData;
use App\Domain\Bookings\Data\QuoteLine;
use App\Domain\Bookings\Data\QuoteSelection;
use App\Domain\Bookings\Data\RuleSet;
use App\Domain\Bookings\Data\SeasonCalendar;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Carbon\CarbonImmutable;
use LogicException;

/**
 * Motor de reservas (spec 16). Servicio PURO: no consulta la BD; recibe RuleSet, FxTable, SeasonCalendar,
 * InventoryReader y la fecha de negocio. Así el MISMO cálculo sirve a sitio/widget, B2B, cotizador, reserva
 * directa y simulador, y se prueba sin BD (BookingEngineQuoteTest con el caso PRD-011 del prototipo).
 *
 * Estado de este archivo (ESQUELETO DE REFERENCIA):
 *  - IMPLEMENTADO (idéntico a proto/assets/js/booking-engine.js): dayStatus (11 pasos de §8.1), month, nextAvailable,
 *    paxRules (§8.1 PaxRulesResolver), ageType, validatePax (mensajes literales) y pasos 1–2 y 11–16 de quote().
 *  - POR IMPLEMENTAR en la historia del backlog (F1A-MOT-06 y E2.7): pasos 3–10 y 12 (tarifas, opciones,
 *    adicionales, alojamiento, suplemento simple, ajustes y promo). Lanzan LogicException para no devolver
 *    precios incompletos en silencio.
 *
 * Dinero: brick/money escala 2 HALF_UP (= round2). En producción se registra como `scoped` y una fábrica arma
 * RuleSet (RuleResolver), FxTable (fin_fx_rates del día), SeasonCalendar (catalog_seasons) e InventoryReader (BD).
 */
final class BookingEngine implements BookingEngineInterface
{
    private const MAX_SEARCH_DAYS = 400;

    private readonly CarbonImmutable $today;

    /** @param array<string, mixed> $ecommerceDefaults sys_settings.ecommerce (defaultPaxRules, paymentModes, depositPctDefault…) */
    public function __construct(
        private readonly RuleSet $rules,
        private readonly FxTable $fx,
        private readonly SeasonCalendar $seasons,
        private readonly InventoryReader $inventory,
        private readonly array $ecommerceDefaults,
        string $today,
    ) {
        $this->today = CarbonImmutable::parse($today)->startOfDay(); // fecha de negocio en la zona del tenant
    }

    // ===================================================================== Disponibilidad (spec 16 §4.1, §8.1)

    public function dayStatus(ProductData $p, string $date, int $seats = 0): DayStatus
    {
        $ranges = $this->rules->on('R-AVAIL-RANGES', $p) ? $p->ranges : null;            // 1
        $day = CarbonImmutable::parse($date)->startOfDay();

        if ($day->lt($this->today)) {                                                    // 2
            return new DayStatus('pasado', 'Fecha pasada', 0);
        }
        $dep = $p->departures[$date] ?? null;                                            // 3

        // 5–6: anticipación y días de operación se evalúan aunque los rangos estén desactivados (prototipo).
        $cutoffH = $this->rules->on('R-CUTOFF', $p)
            ? ($p->cutoffHours ?: ($p->advanceMinDays * 24 ?: (int) $this->rules->param('R-CUTOFF', 'defaultHours', $p)))
            : 0;
        if ($cutoffH > 0 && (int) $this->today->diffInDays($day) * 24 < $cutoffH) { // Carbon 3 devuelve float con signo
            return new DayStatus('fuera_de_plazo', 'Reserva con '.(int) ceil($cutoffH / 24).' día(s) de anticipación', 0);
        }
        if ($p->operatingWeekdays !== null && $this->rules->on('R-WEEKDAYS', $p) && ! in_array($day->dayOfWeek, $p->operatingWeekdays, true)) {
            return new DayStatus('no_opera', 'No opera este día', 0);
        }

        if (($ranges === null || $ranges === []) && $dep === null) {                     // 4
            return $p->hasAvailabilityConfig && ! $this->rules->on('R-AVAIL-RANGES', $p)
                ? new DayStatus('disponible', 'Disponible', null)                        // regla apagada: sin control
                : new DayStatus('sin_configurar', 'Consultar', null);
        }

        $range = null;                                                                   // 7: precedencia de la excepción
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
        if ($range !== null && $range['status'] === 'cerrado') {                         // 8
            return new DayStatus('cerrado', 'Ocupado / cerrado', 0, null, $range['note'], $range);
        }
        if ($range !== null && $range['status'] === 'agotado') {
            return new DayStatus('agotado', 'Agotado', 0, null, $range['note'], $range);
        }

        $cap = $dep !== null ? $dep['capacity'] : ($range['capacity_per_day'] ?? null);  // 9 (CAT-AV-07: la salida prevalece)
        if ($cap === null) {
            return $ranges ? new DayStatus('cerrado', 'Sin salida programada', 0) : new DayStatus('sin_configurar', 'Consultar', 0);
        }

        $sold = $dep !== null ? $dep['sold'] : $this->inventory->soldOn($p->id, $date);   // 10
        $held = $this->inventory->heldOn($p->id, $date);
        $left = max(0, $cap - $sold - $held);

        if ($left <= 0) {                                                                // 11
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

    // ===================================================================== Pasajeros (spec 16 §3.4, §5.1)

    /**
     * Reglas de pasajeros efectivas: defaults del tenant → reglas del producto → efecto de reglas apagadas.
     * Acepta claves de BD (snake_case, catalog_pax_rules) o del prototipo (camelCase).
     *
     * @return array<string, mixed>
     */
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

        // Textos literales del prototipo (las pruebas comparan el mensaje).
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

    // ===================================================================== Precio (spec 16 §8.1 «orden de aplicación»)

    public function quote(ProductData $p, QuoteSelection $sel): BookingQuote
    {
        $currency = $sel->currency;
        if ($currency !== $this->fx->base() && ! $this->rules->on('R-MULTICURRENCY')) {
            // 17 §10.5: sin multimoneda solo se cotiza en la moneda base (el controlador lo devuelve como 422).
            throw new \DomainException('R-MULTICURRENCY');
        }

        $warnings = $this->validatePax($p, $sel->pax)->errors;                                      // 1
        $season = ($sel->date !== null && $this->rules->on('R-SEASON')) ? $this->seasons->for($sel->date) : null; // 2
        $factor = BigDecimal::of($season->factor ?? '1');

        $lines = $this->priceLines($p, $sel, $factor, $warnings);                                    // 3–10 (por implementar)

        $subtotal = $this->sum($currency, array_filter($lines, fn (QuoteLine $l) => ! $l->removed && $l->kind !== 'info')); // 11
        $adjustments = $this->adjustments($p, $sel, $subtotal);                                      // 12 (por implementar)
        $total = $subtotal;
        foreach ($adjustments as $a) {
            $total = $total->plus($a['amount']);
        }
        // 13 — R-PAY-FEE (recargo por tarjeta) se aplica sobre el total; por implementar junto con 12.

        [$mode, $modes, $pct, $holdHours] = $this->paymentPlan($p, $sel);                             // 14–15
        $deposit = $total->multipliedBy(BigDecimal::of($pct)->dividedBy(100, 4), RoundingMode::HALF_UP);
        $balance = $total->minus($deposit);
        $balanceDue = null;
        if ($balance->isPositive() && $sel->date !== null) {
            $days = (int) ($this->rules->param('R-DEPOSIT', 'balanceDueDays', $p) ?? $this->ecommerceDefaults['balanceDueDaysDefault'] ?? 0);
            $balanceDue = CarbonImmutable::parse($sel->date)->subDays($days);
            if ($balanceDue->lt($this->today)) {
                $balanceDue = $this->today;
                $warnings[] = 'El saldo vence antes de hoy: se cobrará de inmediato.';                // CAT-PY-02
            }
        }

        return new BookingQuote(                                                                     // 16
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
            rooms: 0,   // se completan en el paso 9 (alojamiento)
            nights: 0,
            warnings: $warnings,
            ok: $warnings === [] || $this->onlyNonBlocking($warnings),
            season: $season,
        );
    }

    /**
     * Pasos 3–10: tarifa base vigente del canal (segment Adulto/Pasajero) × factor de temporada; niño (tarifa Niño
     * o % del adulto, CAT-PX-03); infante; línea info de temporada; adicionales (R-ADDONS, removibles con
     * R-PREVIEW-REMOVE); alojamiento por tramo/hotel/tipo (R-LODGING, R-LODGING-CAPACITY) y suplemento simple
     * (R-SINGLE-SUPP). Las líneas base nunca son removibles aunque lleguen en `removed[]`.
     *
     * @param  list<string>  $warnings
     * @return list<QuoteLine>
     */
    private function priceLines(ProductData $p, QuoteSelection $sel, BigDecimal $factor, array &$warnings): array
    {
        throw new LogicException('BookingEngine::priceLines por implementar (F1A-MOT-06 / E2.7). Ver spec 16 §8.1 pasos 3–10 y Datasets/prd011.php.');
    }

    /**
     * Paso 12: ajustes sobre el MISMO subtotal (no en cascada): R-GROUP-DISC, R-EARLY-BIRD, R-LAST-MINUTE, promo (R-PROMO).
     *
     * @return list<array{key:string,label:string,amount:Money}>
     */
    private function adjustments(ProductData $p, QuoteSelection $sel, Money $subtotal): array
    {
        throw new LogicException('BookingEngine::adjustments por implementar (spec 16 §8.1 paso 12).');
    }

    /**
     * Pasos 14–15: modalidades y % de adelanto.
     *  modes = política del producto ‖ tenant.paymentModes; sin R-DEPOSIT se quita `adelanto`; con R-PAY-LATER se agrega
     *  `pagar_despues`; vacío ⇒ ['total']. pct = adelanto ? (deposit_pct ‖ R-DEPOSIT.pct ‖ depositPctDefault) : pagar_despues ? 0 : 100.
     *
     * @return array{0:string, 1:list<string>, 2:int, 3:?int}
     */
    private function paymentPlan(ProductData $p, QuoteSelection $sel): array
    {
        $modes = (array) ($this->ecommerceDefaults['paymentModes'] ?? ['total']); // + catalog_payment_policies.modes del producto (fase 2)
        if (! $this->rules->on('R-DEPOSIT', $p)) {
            $modes = array_values(array_diff($modes, ['adelanto']));
        }
        if ($this->rules->on('R-PAY-LATER', $p) && ! in_array('pagar_despues', $modes, true)) {
            $modes[] = 'pagar_despues';
        }
        $modes = $modes ?: ['total'];

        $mode = in_array($sel->paymentMode, $modes, true) ? (string) $sel->paymentMode
            : (in_array('adelanto', $modes, true) ? 'adelanto' : $modes[0]);

        $pct = match ($mode) {
            'adelanto' => (int) ($this->rules->param('R-DEPOSIT', 'pct', $p) ?? $this->ecommerceDefaults['depositPctDefault'] ?? 100),
            'pagar_despues' => 0,
            default => 100,
        };
        $holdHours = $mode === 'pagar_despues' ? (int) $this->rules->param('R-PAY-LATER', 'holdHours', $p) : null;

        return [$mode, $modes, $pct, $holdHours];
    }

    /** @param iterable<QuoteLine> $lines */
    private function sum(string $currency, iterable $lines): Money
    {
        $total = Money::zero($currency);
        foreach ($lines as $l) {
            $total = $total->plus($l->amount);
        }

        return $total;
    }

    /** @param list<string> $warnings */
    private function onlyNonBlocking(array $warnings): bool
    {
        // Bloqueantes (spec 16 §8.1 paso 16): mínimos/máximos de pax, infantes no admitidos, sin tarifa (PRD-BR-005).
        foreach ($warnings as $w) {
            if (str_starts_with($w, 'Se requiere') || str_starts_with($w, 'Máximo') || str_starts_with($w, 'Este servicio no admite') || str_contains($w, 'PRD-BR-005')) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $rules
     * @return array<string, mixed>
     */
    private function camel(array $rules): array
    {
        $out = [];
        foreach ($rules as $k => $v) {
            $out[lcfirst(str_replace('_', '', ucwords((string) $k, '_')))] = $v;
        }

        return $out;
    }
}
