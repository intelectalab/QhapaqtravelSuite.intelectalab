<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CostAllocations
{
    public function __construct(private readonly CorporateDirectory $directory, private readonly AuditLogger $audit) {}

    public function show(string $code): array
    {
        $reservation = $this->reservation($code);
        $account = $this->directory->forClient((string) $reservation->client_id);

        return $this->view($reservation, $account);
    }

    public function replace(string $code, array $rows, int $lockVersion, User $actor): array
    {
        $reservation = $this->reservation($code, true);
        IfMatch::assertMatches($lockVersion, (int) $reservation->lock_version, 'La reserva');
        $account = $this->directory->forClient((string) $reservation->client_id);

        if ($account === null || $account->status !== 'activa') {
            throw ApiException::unprocessable('CORP_ACCOUNT_REQUIRED', 'El cliente de la reserva no tiene una cuenta corporativa activa.');
        }

        $lines = [];
        $total = BigDecimal::zero();

        foreach (array_values($rows) as $index => $row) {
            $center = $this->directory->costCenter($account, (string) ($row['cost_center_id'] ?? $row['cost_center'] ?? ''));
            $traveler = ($row['traveler_id'] ?? null) ? $this->directory->travelerRow($account, (string) $row['traveler_id']) : null;
            $pct = Decimal::round2((string) $row['pct']);

            if (! $pct->isPositive() || $pct->compareTo(100) > 0) {
                throw ApiException::unprocessable('CP-04', 'Cada porcentaje del reparto va de 0,01 a 100.');
            }

            $key = $center->id.'|'.($traveler->id ?? '');
            if (isset($lines[$key])) {
                throw ApiException::unprocessable('CP-04', "El centro de costo {$center->code} aparece dos veces para el mismo viajero. Únelos en una sola línea.");
            }

            $lines[$key] = ['center' => $center, 'traveler' => $traveler, 'pct' => $pct, 'order' => $index];
            $total = $total->plus($pct);
        }

        if ($lines === [] || $total->compareTo(100) !== 0) {
            throw ApiException::unprocessable('CP-04', 'Los porcentajes del reparto deben sumar 100 % (ahora suman '.$total->toScale(2).' %).');
        }

        $amount = Decimal::round2(Decimal::convert((string) $reservation->total_amount, (string) $reservation->currency, (string) $account->currency, (string) ($reservation->fx_rate ?: '1')));
        $parts = Decimal::allocate($amount, array_map(fn (array $line): BigDecimal => $line['pct'], array_values($lines)));
        $before = $this->summary($reservation->id);

        DB::transaction(function () use ($reservation, $account, $lines, $parts, $actor, $before): void {
            DB::table('booking_cost_allocations')->where('reservation_id', $reservation->id)->delete();

            foreach (array_values($lines) as $index => $line) {
                DB::table('booking_cost_allocations')->insert([
                    'id' => (string) Str::uuid7(),
                    'reservation_id' => $reservation->id,
                    'account_id' => $account->id,
                    'cost_center_id' => $line['center']->id,
                    'traveler_id' => $line['traveler']?->id,
                    'pct' => (string) $line['pct'],
                    'amount' => (string) $parts[$index],
                    'currency' => $account->currency,
                    'created_by' => $actor->getKey(),
                ]);
            }

            $this->audit->log('Reserva', (string) $reservation->code, 'reparto_costos', $before, $this->summary($reservation->id));
        });

        $this->directory->reload((string) $account->id);

        return $this->view($this->reservation($code), $account);
    }

    private function reservation(string $code, bool $lock = false): object
    {
        $query = DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at');

        return ($lock ? $query->lock('for no key update') : $query)->first(['id', 'code', 'client_id', 'title', 'status', 'total_amount', 'currency', 'fx_rate', 'lock_version'])
            ?? throw ApiException::notFound('La reserva no existe.');
    }

    private function view(object $reservation, ?object $account): array
    {
        $rows = DB::table('booking_cost_allocations as a')->join('crm_corporate_cost_centers as c', 'c.id', '=', 'a.cost_center_id')->leftJoin('crm_corporate_travelers as t', 't.id', '=', 'a.traveler_id')
            ->where('a.reservation_id', $reservation->id)->orderByDesc('a.pct')->orderBy('c.code')
            ->get(['c.id as cost_center_id', 'c.code', 'c.name', 't.id as traveler_id', 't.full_name', 'a.pct', 'a.amount', 'a.currency']);
        $default = $account?->default_cost_center_id ? DB::table('crm_corporate_cost_centers')->where('id', $account->default_cost_center_id)->first(['id', 'code', 'name']) : null;

        return [
            'reservation' => ['code' => (string) $reservation->code, 'title' => (string) $reservation->title, 'status' => (string) $reservation->status, 'total' => Decimal::toApi((string) $reservation->total_amount), 'currency' => (string) $reservation->currency, 'lock_version' => (int) $reservation->lock_version],
            'account' => $account === null ? null : ['id' => (string) $account->id, 'status' => (string) $account->status, 'currency' => (string) $account->currency, 'client' => (string) $account->client_name],
            'default_cost_center' => $default === null ? null : ['id' => (string) $default->id, 'code' => (string) $default->code, 'name' => (string) $default->name],
            'uses_default' => $rows->isEmpty(),
            'allocations' => $rows->map(fn (object $row): array => [
                'cost_center' => ['id' => (string) $row->cost_center_id, 'code' => (string) $row->code, 'name' => (string) $row->name],
                'traveler' => $row->traveler_id ? ['id' => (string) $row->traveler_id, 'full_name' => (string) $row->full_name] : null,
                'pct' => (string) $row->pct,
                'amount' => Decimal::toApi((string) $row->amount),
                'currency' => (string) $row->currency,
            ])->values()->all(),
            'cost_centers' => $account === null ? [] : $this->directory->costCenterRows((string) $account->id)->where('active', true)->map(fn (object $row): array => ['id' => (string) $row->id, 'code' => (string) $row->code, 'name' => (string) $row->name])->values()->all(),
        ];
    }

    private function summary(string $reservationId): string
    {
        $rows = DB::table('booking_cost_allocations as a')->join('crm_corporate_cost_centers as c', 'c.id', '=', 'a.cost_center_id')->where('a.reservation_id', $reservationId)->orderBy('c.code')->get(['c.code', 'a.pct']);

        return $rows->isEmpty() ? 'centro de costo por defecto' : $rows->map(fn (object $row): string => "{$row->code} {$row->pct} %")->implode(' · ');
    }
}
