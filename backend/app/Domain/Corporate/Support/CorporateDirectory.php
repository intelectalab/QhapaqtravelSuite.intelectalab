<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorporateDirectory
{
    public const STATUSES = ['activa' => 'Activa', 'suspendida' => 'Suspendida', 'cerrada' => 'Cerrada'];

    public const ROLES = ['administrador' => 'Administrador', 'aprobador' => 'Aprobador', 'pagador' => 'Pagador', 'viajero' => 'Viajero'];

    public const BUDGET_PERIODS = ['mensual' => 'Mensual', 'trimestral' => 'Trimestral', 'anual' => 'Anual'];

    public const BUDGET_ALERT = 80;

    private const ACCOUNT_COLUMNS = ['a.*', 'c.code as client_code', 'c.name as client_name', 'c.doc_type as client_doc_type', 'c.doc_number as client_doc_number', 'c.email as client_email', 'c.owner_id as client_owner_id'];

    public function __construct(private readonly TenantContext $context, private readonly CorporateLedger $ledger) {}

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->timezone())->startOfDay();
    }

    public function query(): Builder
    {
        return DB::table('crm_corporate_accounts as a')->join('crm_clients as c', 'c.id', '=', 'a.client_id')->select(self::ACCOUNT_COLUMNS);
    }

    public function find(string $id, User $actor): object
    {
        $account = Str::isUuid($id) ? $this->query()->where('a.id', $id)->first() : null;

        if ($account === null) {
            throw ApiException::notFound('No encontramos esa cuenta corporativa.');
        }

        if (Portfolio::ownOnly($actor) && ! Portfolio::inClients($actor, (string) $account->client_id)) {
            throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Esta cuenta corporativa es de un cliente de otro asesor.', ['crm.records.reassign']);
        }

        return $account;
    }

    public function forClient(string $clientId): ?object
    {
        return $this->query()->where('a.client_id', $clientId)->first();
    }

    public function reload(string $id): object
    {
        $this->ledger->forget($id);

        return $this->query()->where('a.id', $id)->first() ?? throw ApiException::notFound('No encontramos esa cuenta corporativa.');
    }

    public function list(User $actor): array
    {
        $query = $this->query();

        if (Portfolio::ownOnly($actor)) {
            Portfolio::clients($query, $actor, 'c');
        }

        $rows = $query->orderBy('c.name')->get()->map(fn (object $account): array => $this->account($account))->all();

        return $rows;
    }

    public function account(object $account, bool $detail = false): array
    {
        $centers = $this->costCenterRows($account->id);
        $default = $account->default_cost_center_id ? $centers->firstWhere('id', $account->default_cost_center_id) : null;
        $year = (string) $this->today()->year;
        $purchases = $this->ledger->purchases($account)->filter(fn (array $row): bool => str_starts_with($row['date'], $year));
        $users = DB::table('crm_corporate_portal_users')->where('account_id', $account->id);

        $data = [
            'id' => (string) $account->id,
            'client' => ['id' => (string) $account->client_id, 'code' => (string) $account->client_code, 'name' => (string) $account->client_name, 'doc_type' => (string) $account->client_doc_type, 'doc_number' => (string) $account->client_doc_number, 'email' => $account->client_email],
            'status' => (string) $account->status,
            'status_label' => self::STATUSES[$account->status] ?? (string) $account->status,
            'currency' => (string) $account->currency,
            'credit_days' => (int) $account->credit_days,
            'require_approval' => (bool) $account->require_approval,
            'approval_threshold' => Decimal::toApi($account->approval_threshold),
            'approval_ttl_hours' => (int) $account->approval_ttl_hours,
            'default_cost_center' => $default === null ? null : ['id' => (string) $default->id, 'code' => (string) $default->code, 'name' => (string) $default->name],
            'statement_auto' => (bool) $account->statement_auto,
            'statement_day' => (int) $account->statement_day,
            'statement_recipients' => PgArray::parse($account->statement_recipients),
            'statement_last_sent_at' => $account->statement_last_sent_at,
            'notes' => $account->notes,
            'lock_version' => (int) $account->lock_version,
            'created_at' => $account->created_at,
            'balance' => Decimal::toApi($this->ledger->balance($account)),
            'purchases_year' => Decimal::toApi($purchases->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus($row['charge']), BigDecimal::zero())),
            'counts' => [
                'cost_centers' => $centers->where('active', true)->count(),
                'travelers' => DB::table('crm_corporate_travelers')->where('account_id', $account->id)->where('active', true)->count(),
                'portal_users' => (clone $users)->where('status', '<>', 'inactivo')->count(),
                'pending_approvals' => DB::table('booking_corporate_approvals')->where('account_id', $account->id)->where('status', 'pendiente')->count(),
            ],
        ];

        if ($detail) {
            $data['cost_centers'] = $this->costCenters($account);
            $data['travelers'] = $this->travelers($account);
            $data['portal_users'] = $this->portalUsers($account);
        }

        return $data;
    }

    public function costCenterRows(string $accountId): Collection
    {
        return DB::table('crm_corporate_cost_centers')->where('account_id', $accountId)->orderBy('code')->get();
    }

    public function costCenter(object $account, string $key): object
    {
        $row = DB::table('crm_corporate_cost_centers')->where('account_id', $account->id)
            ->where(fn (Builder $query) => Str::isUuid($key) ? $query->where('id', $key) : $query->where('code', Str::upper($key)))
            ->first();

        return $row ?? throw ApiException::notFound('No encontramos ese centro de costo en la cuenta.');
    }

    public function costCenters(object $account, ?CorporateScope $scope = null): array
    {
        $today = $this->today();
        $purchases = $this->ledger->purchases($account);
        $counts = DB::table('crm_corporate_travelers')->where('account_id', $account->id)->where('active', true)->whereNotNull('cost_center_id')
            ->groupBy('cost_center_id')->selectRaw('cost_center_id, count(*) as n')->pluck('n', 'cost_center_id');

        $rows = $this->costCenterRows($account->id);

        if ($scope?->costCenter !== null) {
            $rows = $rows->where('code', $scope->costCenter);
        }

        $result = [];

        foreach ($rows as $center) {
            [$from, $to] = $this->budgetWindow((string) $center->budget_period, $today);
            $used = $purchases->filter(fn (array $row): bool => $row['date'] >= $from && $row['date'] <= $to)
                ->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus((string) (collect($row['allocations'])->firstWhere('cost_center', $center->code)['amount'] ?? '0')), BigDecimal::zero());
            $count = $purchases->filter(fn (array $row): bool => collect($row['allocations'])->contains('cost_center', $center->code))->count();
            $budget = $center->budget_amount === null ? null : BigDecimal::of((string) $center->budget_amount);
            $pct = $budget !== null && $budget->isPositive() ? $used->multipliedBy(100)->dividedBy($budget, 1, RoundingMode::HALF_UP) : null;

            $result[] = [
                'id' => (string) $center->id,
                'code' => (string) $center->code,
                'name' => (string) $center->name,
                'budget_amount' => Decimal::toApi($budget),
                'budget_period' => (string) $center->budget_period,
                'budget_period_label' => self::BUDGET_PERIODS[$center->budget_period] ?? (string) $center->budget_period,
                'budget_window' => ['from' => $from, 'to' => $to],
                'used' => Decimal::toApi($used),
                'used_pct' => $pct === null ? null : (string) $pct,
                'budget_state' => $pct === null ? 'sin_presupuesto' : ($pct->compareTo(100) > 0 ? 'excedido' : ($pct->compareTo(self::BUDGET_ALERT) >= 0 ? 'alerta' : 'en_rango')),
                'purchases' => $count,
                'travelers' => (int) ($counts[$center->id] ?? 0),
                'active' => (bool) $center->active,
                'is_default' => $account->default_cost_center_id === $center->id,
                'updated_at' => $center->updated_at,
            ];
        }

        return $result;
    }

    public function travelers(object $account, ?CorporateScope $scope = null): array
    {
        $centers = $this->costCenterRows($account->id)->pluck('code', 'id');

        return DB::table('crm_corporate_travelers')->where('account_id', $account->id)->orderBy('full_name')->get()
            ->map(fn (object $row): array => $this->traveler($row, $centers))
            ->when($scope?->costCenter !== null, fn (Collection $rows) => $rows->where('cost_center', $scope->costCenter))
            ->values()->all();
    }

    public function traveler(object $row, ?Collection $centers = null): array
    {
        $centers ??= $this->costCenterRows((string) $row->account_id)->pluck('code', 'id');

        return [
            'id' => (string) $row->id,
            'full_name' => (string) $row->full_name,
            'email' => $row->email,
            'doc_type' => $row->doc_type,
            'doc_number' => $row->doc_number,
            'employee_code' => $row->employee_code,
            'cost_center' => $row->cost_center_id ? ($centers[$row->cost_center_id] ?? null) : null,
            'cost_center_id' => $row->cost_center_id,
            'active' => (bool) $row->active,
            'updated_at' => $row->updated_at,
        ];
    }

    public function portalUsers(object $account): array
    {
        $centers = $this->costCenterRows($account->id)->pluck('code', 'id');
        $travelers = DB::table('crm_corporate_travelers')->where('account_id', $account->id)->pluck('full_name', 'id');

        return DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->orderByRaw("case portal_role when 'administrador' then 0 when 'pagador' then 1 when 'aprobador' then 2 else 3 end")->orderBy('full_name')->get()
            ->map(fn (object $row): array => $this->portalUser($row, $centers, $travelers))->values()->all();
    }

    public function portalUser(object $row, ?Collection $centers = null, ?Collection $travelers = null): array
    {
        $centers ??= $this->costCenterRows((string) $row->account_id)->pluck('code', 'id');
        $travelers ??= DB::table('crm_corporate_travelers')->where('account_id', $row->account_id)->pluck('full_name', 'id');

        return [
            'id' => (string) $row->id,
            'full_name' => (string) $row->full_name,
            'email' => (string) $row->email,
            'portal_role' => (string) $row->portal_role,
            'portal_role_label' => self::ROLES[$row->portal_role] ?? (string) $row->portal_role,
            'cost_center' => $row->cost_center_id ? ($centers[$row->cost_center_id] ?? null) : null,
            'cost_center_id' => $row->cost_center_id,
            'traveler' => $row->traveler_id ? ($travelers[$row->traveler_id] ?? null) : null,
            'traveler_id' => $row->traveler_id,
            'status' => (string) $row->status,
            'has_login' => $row->user_id !== null,
            'invited_at' => $row->invited_at,
            'accepted_at' => $row->accepted_at,
            'updated_at' => $row->updated_at,
        ];
    }

    public function portalUserRow(object $account, string $id): object
    {
        $row = Str::isUuid($id) ? DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->where('id', $id)->first() : null;

        return $row ?? throw ApiException::notFound('No encontramos ese usuario en la cuenta corporativa.');
    }

    public function travelerRow(object $account, string $id): object
    {
        $row = Str::isUuid($id) ? DB::table('crm_corporate_travelers')->where('account_id', $account->id)->where('id', $id)->first() : null;

        return $row ?? throw ApiException::notFound('No encontramos ese viajero en la cuenta corporativa.');
    }

    public function budgetWindow(string $period, CarbonImmutable $today): array
    {
        return match ($period) {
            'mensual' => [$today->startOfMonth()->toDateString(), $today->endOfMonth()->toDateString()],
            'trimestral' => [$today->firstOfQuarter()->toDateString(), $today->lastOfQuarter()->toDateString()],
            default => [$today->startOfYear()->toDateString(), $today->endOfYear()->toDateString()],
        };
    }
}
