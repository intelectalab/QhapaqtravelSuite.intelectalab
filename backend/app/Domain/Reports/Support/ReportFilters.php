<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ReportFilters
{
    public const PERIODS = ['month' => 'Este mes', 'quarter' => 'Este trimestre', '6m' => 'Últimos 6 meses', 'all' => 'Todo'];

    private const ALIASES = ['set' => 'month', 'q3' => 'quarter'];

    private function __construct(
        public readonly string $period,
        public readonly Carbon $from,
        public readonly Carbon $to,
        public readonly ?string $sedeId,
        public readonly ?string $sedeName,
        public readonly string $timezone,
    ) {}

    public static function make(?string $period, ?string $sede, string $timezone): self
    {
        $period = self::ALIASES[$period ?? ''] ?? ($period ?: '6m');

        if (! isset(self::PERIODS[$period])) {
            throw ApiException::unprocessable('REPORT_PERIOD', 'El periodo debe ser este mes, este trimestre, los últimos 6 meses o todo.');
        }

        $now = Carbon::now($timezone);
        $from = match ($period) {
            'month' => $now->copy()->startOfMonth(),
            'quarter' => $now->copy()->firstOfQuarter(),
            '6m' => $now->copy()->startOfMonth()->subMonths(5),
            default => Carbon::create(2000, 1, 1, 0, 0, 0, $timezone),
        };
        $name = null;

        if ($sede !== null && $sede !== '') {
            $row = DB::table('iam_sedes')->whereNull('deleted_at')->where(fn ($query) => $query->where('code', $sede)->orWhere('id', preg_match('/^[0-9a-f-]{36}$/i', $sede) ? $sede : null))->first(['id', 'name']);
            $row ?? throw ApiException::unprocessable('REPORT_SEDE', 'La sede no existe.');
            $sede = (string) $row->id;
            $name = (string) $row->name;
        }

        return new self($period, $from, $now->copy()->endOfDay(), $sede ?: null, $name, $timezone);
    }

    public function between(Builder $query, string $column): Builder
    {
        return $query->whereBetween($column, [$this->from->copy()->utc(), $this->to->copy()->utc()]);
    }

    public function sede(Builder $query, string $sedeColumn): Builder
    {
        return $this->sedeId === null ? $query : $query->where($sedeColumn, $this->sedeId);
    }

    public function ownerSede(Builder $query, string $ownerColumn): Builder
    {
        return $this->sedeId === null ? $query : $query->whereIn($ownerColumn, DB::table('iam_users')->where('sede_id', $this->sedeId)->select('id'));
    }

    public function months(): array
    {
        $start = $this->period === 'all' ? $this->to->copy()->startOfMonth()->subMonths(11) : $this->from->copy()->startOfMonth();
        $months = [];

        for ($date = $start->copy(); $date->lessThanOrEqualTo($this->to); $date->addMonth()) {
            $months[$date->format('Y-m')] = ucfirst(rtrim($date->locale('es')->isoFormat('MMM YY'), '.'));
        }

        return $months;
    }

    public function monthExpression(string $column): string
    {
        return "to_char({$column} at time zone '{$this->timezone}', 'YYYY-MM')";
    }

    public function describe(): array
    {
        return [
            'period' => $this->period,
            'label' => self::PERIODS[$this->period],
            'from' => $this->period === 'all' ? null : $this->from->toDateString(),
            'to' => $this->to->toDateString(),
            'sede' => $this->sedeId ? ['id' => $this->sedeId, 'name' => $this->sedeName] : null,
        ];
    }
}
