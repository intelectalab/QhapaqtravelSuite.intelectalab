<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorporateLedger
{
    public const KINDS = ['compra' => 'Compra', 'pago' => 'Pago', 'nota_credito' => 'Nota de crédito'];

    public const ORIGIN_LIVE = 'vivo';

    public const ORIGIN_HISTORY = 'historial';

    private const SKIPPED_RESERVATIONS = ['borrador', 'cancelada'];

    private const PAID = ['confirmado', 'aplicado'];

    private const CREDIT_NOTES = ['emitido', 'aceptado', 'observado'];

    private array $memo = [];

    public function __construct(private readonly TenantContext $context) {}

    public function entries(object $account, ?CorporateScope $scope = null): Collection
    {
        $all = $this->memo[$account->id] ??= $this->build($account);
        $scope ??= CorporateScope::all();

        return $this->withBalance($scope->isAll() ? $all : $this->scoped($all, $scope));
    }

    public function forget(?string $accountId = null): void
    {
        if ($accountId === null) {
            $this->memo = [];

            return;
        }

        unset($this->memo[$accountId]);
    }

    public function balance(object $account, ?CorporateScope $scope = null, ?string $before = null): BigDecimal
    {
        return $this->entries($account, $scope)
            ->when($before !== null, fn (Collection $rows) => $rows->filter(fn (array $row): bool => $row['date'] < $before))
            ->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus($row['charge'])->minus($row['credit']), BigDecimal::zero())
            ->toScale(2);
    }

    public function purchases(object $account, ?CorporateScope $scope = null): Collection
    {
        return $this->entries($account, $scope)->where('kind', 'compra')->values();
    }

    public static function normalize(string $name): string
    {
        return Str::of(Str::ascii($name))->lower()->squish()->toString();
    }

    private function build(object $account): Collection
    {
        $currency = (string) $account->currency;
        $centers = DB::table('crm_corporate_cost_centers')->where('account_id', $account->id)->pluck('code', 'id');
        $defaultCenter = $account->default_cost_center_id ? ($centers[$account->default_cost_center_id] ?? null) : null;
        $travelers = DB::table('crm_corporate_travelers')->where('account_id', $account->id)->pluck('full_name', 'id');
        $reservations = DB::table('booking_reservations')
            ->where('client_id', $account->client_id)
            ->whereNull('deleted_at')
            ->whereNotIn('status', self::SKIPPED_RESERVATIONS)
            ->get(['id', 'code', 'title', 'status', 'travel_from', 'currency', 'fx_rate', 'total_amount', 'created_at']);
        $ids = $reservations->pluck('id')->all();
        $allocations = DB::table('booking_cost_allocations')->where('account_id', $account->id)->whereIn('reservation_id', $ids)
            ->orderBy('created_at')->orderBy('id')->get(['reservation_id', 'cost_center_id', 'traveler_id', 'pct', 'amount'])->groupBy('reservation_id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $ids)->where('is_placeholder', false)
            ->orderBy('seq')->get(['reservation_id', 'full_name'])->groupBy('reservation_id');
        $byReservation = [];
        $entries = [];

        foreach ($reservations as $reservation) {
            $amount = $this->convert((string) $reservation->total_amount, (string) $reservation->currency, $currency, $reservation->fx_rate);
            $split = $this->split($allocations->get($reservation->id, collect()), $centers, $defaultCenter, $amount);
            $names = collect($passengers->get($reservation->id, collect()))->pluck('full_name')
                ->merge(collect($allocations->get($reservation->id, collect()))->pluck('traveler_id')->filter()->map(fn ($id) => $travelers[$id] ?? null))
                ->filter()->map(fn ($name): string => (string) $name)->unique()->values()->all();
            $byReservation[$reservation->id] = ['code' => $reservation->code, 'split' => $split, 'travelers' => $names];
            $entries[] = $this->entry(
                id: "M-{$reservation->code}",
                date: $this->localDate((string) $reservation->created_at),
                kind: 'compra',
                document: (string) $reservation->code,
                reservation: (string) $reservation->code,
                detail: (string) $reservation->title,
                split: $split,
                travelers: $names,
                travelFrom: $reservation->travel_from ? (string) $reservation->travel_from : null,
                charge: $amount,
                credit: BigDecimal::zero(),
            );
        }

        $payments = DB::table('fin_payments')->whereIn('reservation_id', $ids)->where('kind', 'cobro')->whereIn('status', self::PAID)
            ->get(['id', 'code', 'reservation_id', 'method', 'amount', 'currency', 'fx_rate', 'paid_on']);

        foreach ($payments as $payment) {
            $linked = $byReservation[$payment->reservation_id];
            $entries[] = $this->entry(
                id: "M-{$payment->code}",
                date: (string) $payment->paid_on,
                kind: 'pago',
                document: (string) $payment->code,
                reservation: $linked['code'],
                detail: "{$payment->method} · {$linked['code']}",
                split: $linked['split'],
                travelers: $linked['travelers'],
                travelFrom: null,
                charge: BigDecimal::zero(),
                credit: $this->convert((string) $payment->amount, (string) $payment->currency, $currency, $payment->fx_rate),
            );
        }

        $notes = DB::table('fin_invoices')->where('client_id', $account->client_id)->where('doc_type', '07')->whereIn('status', self::CREDIT_NOTES)
            ->whereIn('reservation_id', $ids)->get(['number', 'reservation_id', 'issue_date', 'total_amount', 'currency', 'fx_rate', 'credit_note_reason', 'description']);

        foreach ($notes as $note) {
            $linked = $byReservation[$note->reservation_id];
            $entries[] = $this->entry(
                id: "M-{$note->number}",
                date: (string) $note->issue_date,
                kind: 'nota_credito',
                document: (string) $note->number,
                reservation: $linked['code'],
                detail: trim((string) ($note->credit_note_reason ?: $note->description))." · {$linked['code']}",
                split: $linked['split'],
                travelers: $linked['travelers'],
                travelFrom: null,
                charge: BigDecimal::zero(),
                credit: $this->convert((string) $note->total_amount, (string) $note->currency, $currency, $note->fx_rate),
            );
        }

        $live = collect($entries)->keyBy('id');

        foreach ($this->history($account) as $line) {
            if (! $live->has($line['id'])) {
                $live->put($line['id'], $line);
            }
        }

        return $live->values()->sort(fn (array $a, array $b): int => [$a['date'], $a['kind'] === 'compra' ? 0 : 1, $a['id']] <=> [$b['date'], $b['kind'] === 'compra' ? 0 : 1, $b['id']])->values();
    }

    private function history(object $account): array
    {
        $lines = [];

        foreach (DB::table('fin_corporate_statements')->where('account_id', $account->id)->orderBy('created_at')->pluck('lines') as $raw) {
            foreach ((array) json_decode((string) $raw, true) as $line) {
                if (is_array($line) && ($line['origin'] ?? null) === self::ORIGIN_HISTORY && isset($line['id'])) {
                    $lines[$line['id']] = $this->fromLine($line);
                }
            }
        }

        return array_values($lines);
    }

    private function fromLine(array $line): array
    {
        $split = array_map(fn (array $part): array => ['cost_center' => (string) $part['cost_center'], 'pct' => (string) $part['pct'], 'amount' => Decimal::toApi((string) $part['amount'])], (array) ($line['allocations'] ?? []));

        return [
            'id' => (string) $line['id'],
            'date' => (string) $line['date'],
            'kind' => (string) $line['kind'],
            'kind_label' => self::KINDS[$line['kind']] ?? (string) $line['kind'],
            'document' => (string) $line['document'],
            'reservation' => $line['reservation'] ?? null,
            'detail' => (string) ($line['detail'] ?? ''),
            'cost_center' => $split[0]['cost_center'] ?? ($line['cost_center'] ?? null),
            'allocations' => $split,
            'travelers' => array_values((array) ($line['travelers'] ?? [])),
            'travel_from' => $line['travel_from'] ?? null,
            'charge' => Decimal::toApi((string) ($line['charge'] ?? '0')),
            'credit' => Decimal::toApi((string) ($line['credit'] ?? '0')),
            'origin' => self::ORIGIN_HISTORY,
        ];
    }

    private function entry(string $id, string $date, string $kind, string $document, ?string $reservation, string $detail, array $split, array $travelers, ?string $travelFrom, BigDecimal $charge, BigDecimal $credit): array
    {
        return [
            'id' => $id,
            'date' => $date,
            'kind' => $kind,
            'kind_label' => self::KINDS[$kind],
            'document' => $document,
            'reservation' => $reservation,
            'detail' => $detail,
            'cost_center' => $split[0]['cost_center'] ?? null,
            'allocations' => $split,
            'travelers' => $travelers,
            'travel_from' => $travelFrom,
            'charge' => Decimal::toApi($charge),
            'credit' => Decimal::toApi($credit),
            'origin' => self::ORIGIN_LIVE,
        ];
    }

    private function split(Collection $rows, Collection $centers, ?string $defaultCenter, BigDecimal $amount): array
    {
        $grouped = [];

        foreach ($rows as $row) {
            $code = (string) ($centers[$row->cost_center_id] ?? '');
            if ($code === '') {
                continue;
            }
            $grouped[$code] = ($grouped[$code] ?? BigDecimal::zero())->plus((string) $row->pct);
        }

        if ($grouped === []) {
            return $defaultCenter === null ? [] : [['cost_center' => $defaultCenter, 'pct' => '100.00', 'amount' => Decimal::toApi($amount)]];
        }

        arsort($grouped);
        $parts = Decimal::allocate($amount, array_values($grouped));
        $result = [];

        foreach (array_keys($grouped) as $index => $code) {
            $result[] = ['cost_center' => (string) $code, 'pct' => (string) $grouped[$code]->toScale(2), 'amount' => Decimal::toApi($parts[$index])];
        }

        return $result;
    }

    private function scoped(Collection $entries, CorporateScope $scope): Collection
    {
        return $entries->map(function (array $entry) use ($scope): ?array {
            if ($scope->traveler !== null) {
                $names = array_map(self::normalize(...), $entry['travelers']);

                return in_array($scope->traveler, $names, true) ? $entry : null;
            }

            $part = collect($entry['allocations'])->firstWhere('cost_center', $scope->costCenter);
            if ($part === null) {
                return null;
            }

            $factor = BigDecimal::of($part['pct'])->dividedBy(100, 6, RoundingMode::HALF_UP);

            return [
                ...$entry,
                'cost_center' => $scope->costCenter,
                'allocations' => [$part],
                'charge' => Decimal::toApi(BigDecimal::of($entry['charge'])->multipliedBy($factor)),
                'credit' => Decimal::toApi(BigDecimal::of($entry['credit'])->multipliedBy($factor)),
            ];
        })->filter()->values();
    }

    private function withBalance(Collection $entries): Collection
    {
        $balance = BigDecimal::zero();

        return $entries->map(function (array $entry) use (&$balance): array {
            $balance = $balance->plus($entry['charge'])->minus($entry['credit']);

            return [...$entry, 'balance' => Decimal::toApi($balance)];
        })->values();
    }

    private function convert(string $amount, string $from, string $to, mixed $fx): BigDecimal
    {
        if ($from === $to) {
            return Decimal::round2($amount);
        }

        $rate = $fx !== null && (string) $fx !== '' && BigDecimal::of((string) $fx)->isPositive() ? (string) $fx : '1';

        return Decimal::round2(Decimal::convert($amount, $from, $to, $rate));
    }

    private function localDate(string $timestamp): string
    {
        return Carbon::parse($timestamp)->setTimezone($this->context->timezone())->toDateString();
    }
}
