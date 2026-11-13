<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Corporate\Actions\CorporateStatements;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Corporate\Support\CorporateLedger;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Carbon\CarbonImmutable;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CorporateAccountsSeeder
{
    use SeedsTenant;

    public const ORDER = 90;

    private const RULE = [
        'code' => 'R-CORP-PORTAL',
        'group' => 'Comunicación',
        'name' => 'Portal corporativo',
        'description' => 'La empresa cliente ve en su portal las compras, los movimientos y el estado de cuenta, aprueba compras sobre el umbral y gestiona sus usuarios y centros de costo.',
        'scope' => ['Portal cliente', 'Cotizaciones', 'Finanzas'],
        'min_plan' => 'Professional',
    ];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        $this->rule();

        foreach (KitSeeds::read('corpAccounts') as $seed) {
            $clientId = $this->idByCode('crm_clients', $seed['clientId']);

            if ($clientId === null) {
                continue;
            }

            $this->account($seed, $clientId);
        }
    }

    private function rule(): void
    {
        if (DB::table('sys_booking_rules')->where('tenant_id', $this->tenant->getKey())->where('code', self::RULE['code'])->exists()) {
            return;
        }

        $this->upsert('sys_booking_rules', ['code' => self::RULE['code']], [
            'rule_group' => self::RULE['group'],
            'name' => self::RULE['name'],
            'description' => self::RULE['description'],
            'enabled' => true,
            'params' => '{}',
            'params_schema' => '{}',
            'scope' => PgArray::from(self::RULE['scope']),
            'product_override' => false,
            'is_custom' => false,
            'min_plan' => self::RULE['min_plan'],
            'sort_order' => (int) DB::table('sys_booking_rules')->where('tenant_id', $this->tenant->getKey())->max('sort_order') + 1,
        ]);
    }

    private function account(array $seed, string $clientId): void
    {
        $statement = $seed['statement'];
        $accountId = $this->upsert('crm_corporate_accounts', ['client_id' => $clientId], [
            'status' => $seed['status'],
            'currency' => $seed['currency'],
            'credit_days' => $seed['creditDays'],
            'require_approval' => (bool) $seed['requireApproval'],
            'approval_threshold' => $seed['approvalThreshold'],
            'approval_ttl_hours' => 72,
            'statement_auto' => (bool) $statement['auto'],
            'statement_day' => $statement['day'],
            'statement_recipients' => PgArray::from($statement['recipients']),
            'statement_last_sent_at' => $this->moment($statement['lastSent'].' 06:00'),
            'created_by' => $this->userId('U03'),
        ]);

        $centers = [];
        foreach ($seed['costCenters'] as $center) {
            $centers[$center['id']] = $this->upsert('crm_corporate_cost_centers', ['account_id' => $accountId, 'code' => $center['id']], [
                'name' => $center['name'],
                'budget_amount' => $center['budget'],
                'budget_period' => $center['period'],
                'active' => (bool) $center['active'],
            ]);
        }

        DB::table('crm_corporate_accounts')->where('id', $accountId)->update(['default_cost_center_id' => $centers[$seed['defaultCc']] ?? null]);

        $travelers = $this->travelers($seed, $accountId, $centers);
        $members = $this->members($seed, $accountId, $centers, $travelers);
        $this->allocations($seed, $accountId, $centers);
        $this->approvals($seed, $accountId, $centers, $members, $clientId);
        $this->statements($seed, $accountId);
    }

    private function travelers(array $seed, string $accountId, array $centers): array
    {
        $documents = DB::table('booking_passengers as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('r.tenant_id', $this->tenant->getKey())->where('r.client_id', $this->idByCode('crm_clients', $seed['clientId']))
            ->whereNotNull('p.doc_number')->get(['p.full_name', 'p.doc_type', 'p.doc_number'])->keyBy(fn (object $row): string => CorporateLedger::normalize((string) $row->full_name));
        $names = [];

        foreach ($seed['history'] as $trip) {
            foreach ($trip['travelers'] as $name) {
                $names[$name] ??= $trip['cc'];
            }
        }

        foreach ($seed['users'] as $user) {
            if ($user['role'] === 'viajero') {
                $names[$user['name']] ??= $user['cc'] ?? $seed['defaultCc'];
            }
        }

        $ids = [];
        foreach ($names as $name => $center) {
            $document = $documents->get(CorporateLedger::normalize($name));
            $docType = $document ? (in_array($document->doc_type, ['DNI', 'CE', 'RUC'], true) ? $document->doc_type : ($document->doc_type === 'PASAPORTE' ? 'PAS' : 'OTRO')) : null;
            $ids[$name] = $this->upsert('crm_corporate_travelers', ['account_id' => $accountId, 'full_name' => $name], [
                'cost_center_id' => $centers[$center] ?? null,
                'doc_type' => $docType,
                'doc_number' => $document?->doc_number,
                'active' => true,
            ]);
        }

        return $ids;
    }

    private function members(array $seed, string $accountId, array $centers, array $travelers): array
    {
        $ids = [];

        foreach ($seed['users'] as $user) {
            $userId = $user['userId'] ? DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->where('code', $user['userId'])->value('id') : null;
            $active = $userId !== null && (bool) $user['active'];
            $ids[$user['name']] = $this->upsert('crm_corporate_portal_users', ['account_id' => $accountId, 'email' => $user['email']], [
                'user_id' => $userId,
                'full_name' => $user['name'],
                'portal_role' => $user['role'],
                'cost_center_id' => $user['cc'] ? ($centers[$user['cc']] ?? null) : null,
                'traveler_id' => $user['role'] === 'viajero' ? ($travelers[$user['name']] ?? null) : null,
                'status' => $active ? 'activo' : ($user['active'] ? 'invitado' : 'inactivo'),
                'invited_at' => $this->moment('2026-01-20 10:00'),
                'accepted_at' => $active ? $this->moment('2026-01-21 09:15') : null,
            ]);
        }

        return $ids;
    }

    private function allocations(array $seed, string $accountId, array $centers): void
    {
        foreach ($seed['allocations'] as $code => $allocation) {
            $reservation = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->where('code', $code)->first(['id', 'total_amount', 'currency', 'fx_rate']);
            $center = $centers[$allocation['cc']] ?? null;

            if ($reservation === null || $center === null) {
                continue;
            }

            $amount = Decimal::round2(Decimal::convert((string) $reservation->total_amount, (string) $reservation->currency, (string) $seed['currency'], (string) ($reservation->fx_rate ?: '1')));
            DB::table('booking_cost_allocations')->where('tenant_id', $this->tenant->getKey())->where('reservation_id', $reservation->id)->delete();
            $this->upsert('booking_cost_allocations', ['reservation_id' => $reservation->id, 'cost_center_id' => $center], [
                'account_id' => $accountId,
                'pct' => '100.00',
                'amount' => (string) $amount,
                'currency' => $seed['currency'],
                'created_by' => $this->userId('U03'),
            ]);
        }
    }

    private function approvals(array $seed, string $accountId, array $centers, array $members, string $clientId): void
    {
        $owner = DB::table('crm_clients')->where('id', $clientId)->value('owner_id');

        foreach ($seed['approvals'] as $approval) {
            $quoteId = str_starts_with($approval['ref'], 'COT-') ? $this->idByCode('quote_quotes', $approval['ref']) : null;
            $reservationId = str_starts_with($approval['ref'], 'RES-') ? $this->idByCode('booking_reservations', $approval['ref']) : null;
            $center = $centers[$approval['cc']] ?? null;

            if (($quoteId === null && $reservationId === null) || $center === null) {
                continue;
            }

            $requester = $members[$approval['requestedBy']] ?? null;
            $decided = in_array($approval['status'], ['aprobada', 'rechazada'], true);
            $this->upsert('booking_corporate_approvals', ['code' => $approval['id']], [
                'account_id' => $accountId,
                'quote_id' => $quoteId,
                'reservation_id' => $reservationId,
                'cost_center_id' => $center,
                'amount' => $approval['amount'],
                'currency' => $approval['currency'],
                'requested_by_portal_user_id' => $requester,
                'requested_by_user_id' => $requester === null ? $owner : null,
                'approver_portal_user_id' => $decided ? ($members[$approval['approver']] ?? null) : null,
                'status' => $approval['status'],
                'reason' => $approval['reason'] ?: null,
                'expires_at' => $this->moment($approval['expiresAt'].' 23:59'),
                'decided_at' => $decided ? $this->moment($approval['decidedAt']) : null,
                'created_at' => $this->moment($approval['requestedAt']),
            ]);
        }
    }

    private function statements(array $seed, string $accountId): void
    {
        $history = $this->history($seed);

        if ($history === []) {
            return;
        }

        $tenantId = (string) $this->tenant->getKey();
        $today = CarbonImmutable::now($this->tenant->timezone ?: 'America/Lima')->startOfMonth();
        $first = CarbonImmutable::parse(min(array_column($history, 'date')))->startOfMonth();
        $last = CarbonImmutable::parse(max(array_column($history, 'date')))->startOfMonth();
        $end = $last->greaterThan($today->subMonth()) ? $last : $today->subMonth();
        $recipients = PgArray::from($seed['statement']['recipients']);

        app(TenantDatabase::class)->run($tenantId, function () use ($accountId, $history, $first, $end, $today, $recipients): void {
            $statements = app(CorporateStatements::class);

            for ($month = $first; $month->lessThanOrEqualTo($end); $month = $month->addMonth()) {
                $exists = DB::table('fin_corporate_statements')->where('account_id', $accountId)->where('period_start', $month->toDateString())->where('status', '<>', 'anulado')->exists();
                if ($exists) {
                    continue;
                }

                $account = app(CorporateDirectory::class)->reload($accountId);
                $row = $statements->generate($account, $month->format('Y-m'), null, $history);
                $sentAt = $month->addMonth()->setTime(6, 0);

                if ($month->lessThan($today) && $sentAt->isPast()) {
                    DB::table('fin_corporate_statements')->where('id', $row->id)->update(['status' => 'enviado', 'sent_at' => $sentAt, 'sent_to' => $recipients]);
                }
            }
        });
    }

    private function history(array $seed): array
    {
        $lines = [];

        foreach ($seed['history'] as $trip) {
            $split = [['cost_center' => $trip['cc'], 'pct' => '100.00', 'amount' => Decimal::toApi((string) $trip['amount'])]];
            $base = ['reservation' => $trip['resId'], 'allocations' => $split, 'cost_center' => $trip['cc'], 'travelers' => $trip['travelers'], 'origin' => CorporateLedger::ORIGIN_HISTORY];
            $lines[] = [...$base, 'id' => "M-{$trip['resId']}", 'date' => $this->day($trip['date']), 'kind' => 'compra', 'kind_label' => 'Compra', 'document' => $trip['resId'], 'detail' => $trip['title'], 'travel_from' => $this->day($trip['travelFrom']), 'charge' => Decimal::toApi((string) $trip['amount']), 'credit' => '0.00'];

            foreach ($trip['payments'] ?? [] as $payment) {
                $lines[] = [...$base, 'id' => "M-{$payment['id']}", 'date' => $this->day($payment['date']), 'kind' => 'pago', 'kind_label' => 'Pago', 'document' => $payment['id'], 'detail' => "{$payment['method']} · {$trip['resId']}", 'travel_from' => null, 'charge' => '0.00', 'credit' => Decimal::toApi((string) $payment['amount'])];
            }

            if (isset($trip['creditNote'])) {
                $note = $trip['creditNote'];
                $lines[] = [...$base, 'id' => "M-{$note['id']}", 'date' => $this->day($note['date']), 'kind' => 'nota_credito', 'kind_label' => 'Nota de crédito', 'document' => $note['id'], 'detail' => "{$note['reason']} · {$trip['resId']}", 'travel_from' => null, 'charge' => '0.00', 'credit' => Decimal::toApi((string) $note['amount'])];
            }
        }

        return $lines;
    }
}
