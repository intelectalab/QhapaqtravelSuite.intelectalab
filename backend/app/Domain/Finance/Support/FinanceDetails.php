<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class FinanceDetails
{
    public function __construct(private readonly Consolidation $money, private readonly PaymentMethods $methods) {}

    public function receivable(string $code, User $viewer): ?array
    {
        $row = DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->join('crm_clients as c', 'c.id', '=', 'f.client_id')
            ->where('f.code', $code)->whereNull('f.deleted_at')
            ->first(['f.*', 'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status', 'c.code as client_code', 'c.name as client_name', 'c.email as client_email']);

        if ($row === null) {
            return null;
        }

        return [
            'code' => $row->code, 'kind' => $row->kind, 'concept' => $row->concept, 'status' => $row->status, 'currency' => $row->currency, 'fx_rate' => (string) $row->fx_rate,
            'amount' => (string) $row->amount, 'paid' => (string) $row->paid_amount, 'balance' => (string) Decimal::of($row->amount)->minus((string) $row->paid_amount)->toScale(2),
            'due_date' => $row->due_date, 'cancel_reason' => $row->cancel_reason, 'created_at' => $row->created_at, 'last_reminder_at' => $row->last_reminder_at, 'lock_version' => (int) $row->lock_version,
            'balance_pen' => (string) $this->money->penExact(Decimal::of($row->amount)->minus((string) $row->paid_amount), $row->currency, $row->fx_rate),
            'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title, 'status' => $row->reservation_status],
            'client' => ['code' => $row->client_code, 'name' => $row->client_name, 'email' => $row->client_email],
            'payments' => DB::table('fin_payment_applications as a')->join('fin_payments as p', 'p.id', '=', 'a.payment_id')->where('a.receivable_id', $row->id)->orderByDesc('a.applied_at')
                ->get(['p.code', 'p.paid_on', 'p.method', 'p.reference', 'p.status', 'a.amount', 'a.applied_at', 'a.reversed_at']),
            'invoices' => DB::table('fin_invoices')->where('receivable_id', $row->id)->orderByDesc('issue_date')->get(['number', 'doc_type', 'issue_date', 'total_amount', 'currency', 'status']),
            'reminders' => DB::table('fin_receivable_reminders as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.sent_by')->where('m.receivable_id', $row->id)->orderByDesc('m.sent_at')
                ->get(['m.channels', 'm.sent_at', 'm.balance_at_send', 'u.name as sent_by']),
            'notifications' => DB::table('notif_messages')->where('source_id', $row->id)->orderByDesc('created_at')->limit(20)->get(['code', 'channel', 'recipient_address', 'subject', 'status', 'sent_at', 'created_at']),
            'audit' => $this->audit('Cuenta por cobrar', $row->code),
            'methods' => $viewer->can('finance.payments.register') ? $this->methods->options() : [],
            'today' => $this->money->today(),
            'usd_rate' => $this->money->usdRate(),
            'can' => ['register' => $viewer->can('finance.payments.register'), 'invoice' => $viewer->can('finance.invoicing')],
        ];
    }

    public function payment(string $code, User $viewer): ?array
    {
        $row = DB::table('fin_payments as p')->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->leftJoin('iam_users as u', 'u.id', '=', 'p.registered_by')
            ->where('p.code', $code)->first(['p.*', 'r.code as reservation_code', 'r.title as reservation_title', 'c.code as client_code', 'c.name as client_name', 'u.name as registered_name']);

        if ($row === null) {
            return null;
        }

        return [
            'code' => $row->code, 'kind' => $row->kind, 'source' => $row->source, 'method' => $row->method, 'amount' => (string) $row->amount, 'currency' => $row->currency, 'fx_rate' => (string) $row->fx_rate,
            'pen' => (string) $this->money->penExact($row->amount, $row->currency, $row->fx_rate)->toScale(2, RoundingMode::HALF_UP),
            'paid_on' => $row->paid_on, 'reference' => $row->reference, 'note' => $row->note, 'status' => $row->status, 'reject_reason' => $row->reject_reason, 'retries' => (int) $row->retries, 'lock_version' => (int) $row->lock_version,
            'reverted_at' => $row->reverted_at, 'revert_reason' => $row->revert_reason, 'reported_by_agency' => (bool) $row->reported_by_agency, 'registered_by' => $row->registered_name, 'created_at' => $row->created_at,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
            'client' => $row->client_code ? ['code' => $row->client_code, 'name' => $row->client_name] : null,
            'applications' => DB::table('fin_payment_applications as a')->join('fin_receivables as f', 'f.id', '=', 'a.receivable_id')->where('a.payment_id', $row->id)->orderBy('a.applied_at')
                ->get(['f.code', 'f.concept', 'f.due_date', 'a.amount', 'a.applied_at', 'a.reversed_at']),
            'bank_line' => DB::table('fin_bank_lines')->where('matched_payment_id', $row->id)->first(['code', 'value_date', 'description', 'amount', 'status']),
            'history' => $this->statusHistory('payment', $row->id),
            'audit' => $this->audit('Pago', $row->code),
            'can' => ['retry' => $viewer->can('finance.payments.register')],
        ];
    }

    public function payable(string $code, User $viewer): ?array
    {
        $row = DB::table('fin_payables as f')->leftJoin('catalog_providers as p', 'p.id', '=', 'f.provider_id')->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'f.reservation_service_id')->leftJoin('iam_users as u', 'u.id', '=', 'f.approved_by')
            ->where('f.code', $code)->whereNull('f.deleted_at')
            ->leftJoin('fin_treasury_accounts as sa', 'sa.id', '=', 'f.scheduled_bank_account_id')->leftJoin('iam_users as su', 'su.id', '=', 'f.scheduled_by')
            ->first(['f.*', 'p.ref as provider_ref', 'p.name as provider_name', 'p.ruc as provider_ruc', 'p.payment_terms', 'r.code as reservation_code', 'r.title as reservation_title', 's.name as service_name', 'u.name as approved_name', 'sa.code as scheduled_account_code', 'sa.name as scheduled_account_name', 'su.name as scheduled_name']);

        if ($row === null) {
            return null;
        }

        return [
            'code' => $row->code, 'kind' => $row->kind, 'cost_type' => $row->cost_type, 'concept' => $row->concept, 'status' => $row->status, 'currency' => $row->currency, 'fx_rate' => (string) $row->fx_rate,
            'amount' => (string) $row->amount, 'paid' => (string) $row->paid_amount, 'balance' => (string) Decimal::of($row->amount)->minus((string) $row->paid_amount)->toScale(2),
            'due_date' => $row->due_date, 'scheduled_date' => $row->scheduled_date, 'supplier_doc' => $row->supplier_doc_number, 'evidence' => $row->evidence_note, 'observation' => $row->observation,
            'approved_at' => $row->approved_at, 'approved_by' => $row->approved_name, 'created_at' => $row->created_at, 'lock_version' => (int) $row->lock_version,
            'scheduled' => $row->scheduled_date ? ['date' => $row->scheduled_date, 'account' => $row->scheduled_account_code ? ['code' => $row->scheduled_account_code, 'name' => $row->scheduled_account_name] : null, 'by' => $row->scheduled_name] : null,
            'provider' => $row->provider_name ? ['ref' => $row->provider_ref, 'name' => $row->provider_name, 'ruc' => $row->provider_ruc, 'terms' => $row->payment_terms] : null,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title, 'service' => $row->service_name] : null,
            'payouts' => DB::table('fin_payable_payouts as o')->leftJoin('fin_treasury_accounts as a', 'a.id', '=', 'o.bank_account_id')->where('o.payable_id', $row->id)->orderByDesc('o.paid_on')
                ->get(['o.code', 'o.paid_on', 'o.amount', 'o.method', 'o.operation_ref', 'a.name as account']),
            'history' => $this->statusHistory('payable', $row->id),
            'audit' => $this->audit('Cuenta por pagar', $row->code),
            'bank_accounts' => self::bankAccounts($row->currency),
            'today' => $this->money->today(),
            'can' => ['manage' => $viewer->can('finance.payables'), 'operate' => $viewer->can('finance.payables') && $viewer->can('finance.payments.register')],
        ];
    }

    public function commission(string $code, User $viewer): ?array
    {
        $row = DB::table('fin_commissions as m')->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')->leftJoin('iam_users as u', 'u.id', '=', 'm.beneficiary_user_id')
            ->leftJoin('channel_b2b_agencies as g', 'g.id', '=', 'm.beneficiary_agency_id')->leftJoin('fin_commission_rules as rule', 'rule.id', '=', 'm.rule_id')->leftJoin('iam_users as a', 'a.id', '=', 'm.approved_by')
            ->where('m.code', $code)->whereNull('m.deleted_at')
            ->first(['m.*', 'r.code as reservation_code', 'r.title as reservation_title', 'u.name as user_name', 'g.legal_name as agency_name', 'rule.pct as rule_pct', 'rule.active as rule_active', 'rule.condition as rule_condition', 'a.name as approved_name']);

        if ($row === null) {
            return null;
        }

        $expected = $row->rule_pct !== null ? Decimal::of($row->base_amount)->multipliedBy((string) $row->rule_pct)->dividedBy(100, 2, RoundingMode::HALF_UP) : null;

        return [
            'code' => $row->code, 'kind' => $row->kind, 'status' => $row->status, 'currency' => $row->currency, 'fx_rate' => (string) $row->fx_rate, 'lock_version' => (int) $row->lock_version,
            'base' => (string) $row->base_amount, 'pct' => (string) $row->pct, 'amount' => (string) $row->amount, 'rule' => $row->rule_description,
            'beneficiary' => $row->user_name ?? $row->agency_name, 'beneficiary_kind' => $row->beneficiary_user_id ? 'asesor' : 'agencia',
            'approved_at' => $row->approved_at, 'approved_by' => $row->approved_name, 'paid_at' => $row->paid_at, 'payment_method' => $row->payment_method, 'payment_ref' => $row->payment_ref, 'observation' => $row->observation,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
            'current_rule' => $row->rule_pct !== null ? ['pct' => (string) $row->rule_pct, 'active' => (bool) $row->rule_active, 'condition' => $row->rule_condition, 'expected' => (string) $expected, 'difference' => (string) Decimal::of($row->amount)->minus($expected)->toScale(2)] : null,
            'history' => $this->statusHistory('commission', $row->id),
            'audit' => $this->audit('Comisión', $row->code),
            'can' => ['recalculate' => $viewer->can('finance.commissions') && $viewer->can('finance.payments.register')],
        ];
    }

    public function settlement(string $reservationCode): ?array
    {
        $reservation = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.code', $reservationCode)->whereNull('r.deleted_at')
            ->first(['r.id', 'r.code', 'r.title', 'r.status', 'r.currency', 'r.fx_rate', 'r.total_amount', 'r.travel_to', 'c.name as client']);

        if ($reservation === null) {
            return null;
        }

        $fx = (string) ($reservation->fx_rate ?: 1);
        $pen = fn ($amount, ?string $rate = null): BigDecimal => Decimal::of((string) $amount)->multipliedBy($rate ?? $fx)->toScale(2, RoundingMode::HALF_UP);
        $receivables = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->orderBy('due_date')->get(['code', 'concept', 'amount', 'paid_amount', 'currency', 'fx_rate', 'status', 'due_date']);
        $payables = DB::table('fin_payables as f')->leftJoin('catalog_providers as p', 'p.id', '=', 'f.provider_id')->where('f.reservation_id', $reservation->id)->whereNull('f.deleted_at')->whereNotIn('f.status', ['anulada', 'cancelada'])
            ->get(['f.code', 'f.kind', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.fx_rate', 'f.status', 'f.approved_at', 'p.name as provider']);
        $pendingExtras = $payables->filter(fn (object $row): bool => $row->kind === 'costo_adicional' && $row->approved_at === null);
        $payables = $payables->reject(fn (object $row): bool => $row->kind === 'costo_adicional' && $row->approved_at === null)->values();
        $commissions = DB::table('fin_commissions')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'anulada')->get(['code', 'kind', 'amount', 'currency', 'fx_rate', 'status']);
        $income = $receivables->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($reservation->currency === 'PEN' ? Decimal::withoutIgv((string) $row->amount) : $row->amount, (string) ($row->fx_rate ?: $fx))), BigDecimal::zero());
        $collectedGross = $receivables->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($row->amount, (string) ($row->fx_rate ?: $fx))), BigDecimal::zero());
        $collected = $receivables->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($row->paid_amount, (string) ($row->fx_rate ?: $fx))), BigDecimal::zero());
        $costOf = fn (iterable $rows): BigDecimal => collect($rows)->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($row->amount, (string) ($row->fx_rate ?: 1))), BigDecimal::zero());
        $extraCost = $costOf($payables->where('kind', 'costo_adicional'));
        $cost = $costOf($payables);
        $serviceCost = $cost->minus($extraCost);
        $gross = $income->minus($cost);
        $paidOut = $payables->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($row->paid_amount, (string) ($row->fx_rate ?: 1))), BigDecimal::zero());
        $commission = $commissions->reduce(fn (BigDecimal $sum, object $row) => $sum->plus($pen($row->amount, (string) ($row->fx_rate ?: 1))), BigDecimal::zero());
        $net = $gross->minus($commission);
        $pct = fn (BigDecimal $value): ?string => $income->isZero() ? null : (string) $value->multipliedBy(100)->dividedBy($income, 1, RoundingMode::HALF_UP);
        $closed = DB::table('fin_settlements as s')->leftJoin('iam_users as u', 'u.id', '=', 's.closed_by')->where('s.reservation_id', $reservation->id)->first(['s.closed_at', 'u.name as closed_by', 's.net_pen', 's.gross_margin_pct']);

        $checks = [
            ['key' => 'trip', 'label' => 'El viaje terminó', 'ok' => $reservation->status === 'completada', 'detail' => $reservation->status === 'completada' ? 'Reserva completada' : 'Estado actual: '.str_replace('_', ' ', (string) $reservation->status)],
            ['key' => 'receivables', 'label' => 'Tiene cuentas por cobrar', 'ok' => $receivables->isNotEmpty(), 'detail' => $receivables->isNotEmpty() ? $receivables->count().' cuota(s)' : 'La reserva no tiene cuotas: créalas antes de liquidar'],
            ['key' => 'collected', 'label' => 'Todo cobrado', 'ok' => $receivables->isNotEmpty() && $collected->isGreaterThanOrEqualTo($collectedGross), 'detail' => 'Falta cobrar S/ '.$collectedGross->minus($collected)->toScale(2)],
            ['key' => 'extras', 'label' => 'Costos adicionales aprobados', 'ok' => $pendingExtras->isEmpty(), 'detail' => $pendingExtras->isEmpty() ? 'Sin costos por aprobar' : $pendingExtras->count().' costo(s) adicional(es) por aprobar'],
            ['key' => 'paid', 'label' => 'Proveedores pagados', 'ok' => $paidOut->isGreaterThanOrEqualTo($cost), 'detail' => 'Falta pagar S/ '.$cost->minus($paidOut)->toScale(2)],
            ['key' => 'commissions', 'label' => 'Comisiones aprobadas', 'ok' => $commissions->whereIn('status', ['calculada', 'pendiente'])->isEmpty(), 'detail' => $commissions->whereIn('status', ['calculada', 'pendiente'])->count().' por aprobar'],
        ];

        return [
            'reservation' => ['code' => $reservation->code, 'title' => $reservation->title, 'status' => $reservation->status, 'client' => $reservation->client, 'currency' => $reservation->currency],
            'statement' => [
                'income' => (string) $income, 'service_cost' => (string) $serviceCost, 'extra_cost' => (string) $extraCost, 'pending_extra_cost' => (string) $costOf($pendingExtras),
                'cost' => (string) $cost, 'gross' => (string) $gross, 'commissions' => (string) $commission, 'net' => (string) $net,
                'margin_pct' => $pct($gross), 'net_pct' => $pct($net),
            ],
            'cash' => ['collected' => (string) $collected, 'paid_out' => (string) $paidOut, 'position' => (string) $collected->minus($paidOut)->minus($commission)],
            'receivables' => $receivables, 'payables' => $payables, 'commissions' => $commissions,
            'checks' => $checks, 'can_close' => $closed === null && collect($checks)->every(fn (array $check) => $check['ok']),
            'closed' => $closed,
        ];
    }

    public static function bankAccounts(?string $currency = null): array
    {
        return self::bankAccountQuery($currency)->orderBy('code')
            ->get(['code', 'name', 'bank', 'currency'])->map(fn (object $row): array => ['value' => $row->code, 'label' => "{$row->name} · {$row->currency}", 'currency' => $row->currency])->all();
    }

    public static function bankAccountQuery(?string $currency = null): Builder
    {
        return DB::table('fin_treasury_accounts')->whereNull('deleted_at')->where('kind', 'bank')->where('status', 'active')->when($currency !== null, fn ($query) => $query->where('currency', $currency));
    }

    private function statusHistory(string $type, string $id): Collection
    {
        return DB::table('fin_status_history as h')->leftJoin('iam_users as u', 'u.id', '=', 'h.user_id')->where('h.entity_type', $type)->where('h.entity_id', $id)->orderBy('h.created_at')
            ->get(['h.status', 'h.note', 'h.created_at', 'u.name as user']);
    }

    private function audit(string $entity, string $code): Collection
    {
        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')->where('e.entity', $entity)->where('e.entity_id', $code)->orderByDesc('e.occurred_at')->limit(50)
            ->get(['e.id', 'e.action', 'e.before_value as before', 'e.after_value as after', 'e.occurred_at', 'u.name as actor']);
    }
}
