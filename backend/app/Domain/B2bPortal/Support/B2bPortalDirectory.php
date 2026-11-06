<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Support;

use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class B2bPortalDirectory
{
    private const LIVE_RECEIVABLE = ['abierta', 'parcial', 'vencida'];

    public function __construct(
        private readonly B2bCatalog $catalog,
        private readonly PaymentMethods $methods,
        private readonly TenantContext $context,
    ) {}

    public function session(B2bAccount $account): array
    {
        $tenant = $this->context->tenant();

        return [
            'agency' => $this->agencyCard($account),
            'tenant' => ['name' => $tenant->commercial_name, 'initials' => $tenant->logo_initials, 'email' => $tenant->email ?? null, 'phone' => $tenant->phone ?? null],
            'user' => ['name' => $account->user->name, 'email' => $account->user->email, 'color' => $account->user->avatar_color],
            'counts' => [
                'reservations' => $account->reservations()->whereNotIn('status', ReservationWorkflow::CLOSED)->where('travel_to', '>=', $account->today)->count(),
                'catalog' => $this->catalog->products($account)->whereNull('reason')->count(),
                'due' => $this->receivables($account)->filter(fn (object $row): bool => in_array($row->status, self::LIVE_RECEIVABLE, true) && $row->due_date <= Carbon::parse($account->today)->addDays(7)->toDateString())->count(),
            ],
        ];
    }

    public function home(B2bAccount $account): array
    {
        $today = $account->today;
        $monthStart = Carbon::parse($today)->startOfMonth()->toDateString();
        $reservations = $account->reservations()->orderBy('travel_from')->get(['id', 'code', 'title', 'status', 'travel_from', 'travel_to', 'total_amount', 'currency', 'client_id', 'b2b_terms', 'created_at']);
        $live = $reservations->reject(fn (object $row): bool => in_array($row->status, ReservationWorkflow::CLOSED, true));
        $upcoming = $live->filter(fn (object $row): bool => $row->travel_to >= $today)->take(6);
        $pax = $this->paxCounts($upcoming->pluck('id')->all());
        $clients = DB::table('crm_clients')->whereIn('id', $upcoming->pluck('client_id')->unique()->all())->pluck('name', 'id');
        $commissions = $this->commissions($account);
        $monthCommissions = $commissions->filter(fn (object $row): bool => substr((string) $row->created_at, 0, 10) >= $monthStart);
        $monthSales = $reservations->filter(fn (object $row): bool => $row->status !== 'cancelada' && substr((string) $row->created_at, 0, 10) >= $monthStart);
        $trend = collect(range(5, 0))->map(function (int $back) use ($reservations, $today): array {
            $month = Carbon::parse($today)->startOfMonth()->subMonths($back);
            $rows = $reservations->filter(fn (object $row): bool => $row->status !== 'cancelada' && substr((string) $row->created_at, 0, 7) === $month->format('Y-m'));

            return ['month' => $month->format('Y-m'), 'count' => $rows->count()];
        })->values();

        return [
            'today' => $today,
            'credit' => $this->credit($account),
            'commission_month' => $this->money($monthCommissions),
            'commission_pending' => $this->money($commissions->whereIn('status', ['calculada', 'aprobada'])),
            'sales_month' => $this->money($monthSales, 'total_amount'),
            'bookings_month' => $monthSales->count(),
            'trend' => $trend,
            'active' => $live->count(),
            'upcoming' => $upcoming->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'from' => $row->travel_from,
                'to' => $row->travel_to,
                'days_left' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($row->travel_from), false),
                'pax' => $pax[$row->id]['total'] ?? 0,
                'pending_names' => $pax[$row->id]['pending'] ?? 0,
                'client' => $clients[$row->client_id] ?? null,
                'reference' => $this->terms($row)['agency_ref'] ?? null,
            ])->values(),
            'alerts' => $this->alerts($account),
            'catalog' => $this->catalog->products($account)->whereNull('reason')->take(3)->map(fn (object $row): array => $this->catalog->card($account, $row))->values(),
        ];
    }

    public function catalog(B2bAccount $account): array
    {
        $products = $this->catalog->products($account);

        return [
            'today' => $account->today,
            'credit' => $this->credit($account),
            'blocked' => $account->bookingBlock(),
            'products' => $products->map(fn (object $row): array => $this->catalog->card($account, $row))->values(),
        ];
    }

    public function product(B2bAccount $account, string $code, ?string $month, int $seats): array
    {
        $row = $this->catalog->product($account, $code);
        $month = $month && preg_match('/^\d{4}-\d{2}$/', $month) ? $month : substr($account->today, 0, 7);
        $min = substr($account->today, 0, 7);

        return [
            'today' => $account->today,
            'credit' => $this->credit($account),
            'product' => $this->catalog->detail($account, $row, $month < $min ? $min : $month, max(1, $seats)),
            'doc_types' => ['DNI', 'Pasaporte', 'CE'],
        ];
    }

    public function reservations(B2bAccount $account): array
    {
        $rows = $account->reservations()->orderByDesc('created_at')->get(['id', 'code', 'title', 'status', 'travel_from', 'travel_to', 'total_amount', 'currency', 'client_id', 'b2b_terms', 'created_at']);
        $ids = $rows->pluck('id')->all();
        $pax = $this->paxCounts($ids);
        $clients = DB::table('crm_clients')->whereIn('id', $rows->pluck('client_id')->unique()->all())->pluck('name', 'id');
        $receivables = DB::table('fin_receivables')->whereIn('reservation_id', $ids)->whereNull('deleted_at')->where('status', '<>', 'cancelada')
            ->selectRaw('reservation_id, sum(amount) as amount, sum(paid_amount) as paid')->groupBy('reservation_id')->get()->keyBy('reservation_id');
        $requests = DB::table('booking_cancel_requests')->whereIn('reservation_id', $ids)->where('status', 'pendiente')->pluck('reservation_id')->flip();
        $vouchers = DB::table('ops_vouchers')->whereIn('reservation_id', $ids)->where('status', '<>', 'anulado')->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return [
            'today' => $account->today,
            'reservations' => $rows->map(function (object $row) use ($pax, $clients, $receivables, $requests, $vouchers): array {
                $terms = $this->terms($row);
                $money = $receivables->get($row->id);
                $amount = (float) ($money->amount ?? 0);
                $paid = (float) ($money->paid ?? 0);

                return [
                    'code' => $row->code,
                    'title' => $row->title,
                    'status' => $row->status,
                    'from' => $row->travel_from,
                    'to' => $row->travel_to,
                    'created_at' => $row->created_at,
                    'client' => $clients[$row->client_id] ?? null,
                    'reference' => $terms['agency_ref'] ?? null,
                    'pay_mode' => $terms['pay_mode'] ?? null,
                    'pax' => $pax[$row->id]['total'] ?? 0,
                    'pending_names' => $pax[$row->id]['pending'] ?? 0,
                    'total' => ChannelKit::money($row->total_amount),
                    'currency' => $row->currency,
                    'paid' => ChannelKit::money($paid),
                    'balance' => ChannelKit::money($amount - $paid),
                    'vouchers' => (int) ($vouchers[$row->id] ?? 0),
                    'cancel_pending' => $requests->has($row->id),
                ];
            })->values(),
        ];
    }

    public function reservation(B2bAccount $account, string $code): array
    {
        $reservation = $account->reservation($code);
        $terms = $this->terms($reservation);
        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'rechazado'])->whereNull('replaced_by_id')
            ->orderBy('service_date')->orderByRaw('service_time nulls last')->orderBy('code')
            ->get(['code', 'name', 'service_date', 'service_time', 'service_kind', 'status', 'pax', 'confirmation_code']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')
            ->get(['seq', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'nationality', 'birth_date', 'is_lead', 'is_placeholder', 'pending']);
        $vouchers = DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', '<>', 'anulado')->orderBy('service_date')
            ->get(['code', 'service_label', 'service_date', 'status', 'version', 'pax', 'issued_at']);
        $receivables = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->orderBy('due_date')
            ->get(['code', 'concept', 'amount', 'paid_amount', 'currency', 'due_date', 'status']);
        $reported = $this->reported($receivables->pluck('code')->all());
        $payments = $this->payments(DB::table('fin_payments as p')->where('p.reservation_id', $reservation->id));
        $request = DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->orderByDesc('requested_at')->first(['reason', 'status', 'requested_at', 'decided_at', 'decision_note']);
        $commission = DB::table('fin_commissions')->where('reservation_id', $reservation->id)->where('kind', 'agencia_b2b')->whereNull('deleted_at')->first(['amount', 'pct', 'currency', 'status']);
        $client = DB::table('crm_clients')->where('id', $reservation->client_id)->first(['code', 'name']);
        $amount = (float) $receivables->sum('amount');
        $paid = (float) $receivables->sum('paid_amount');
        $closed = in_array($reservation->status, ReservationWorkflow::CLOSED, true);

        return [
            'today' => $account->today,
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'created_at' => $reservation->created_at,
            'days_left' => (int) Carbon::parse($account->today)->diffInDays(Carbon::parse($reservation->travel_from), false),
            'client' => $client ? ['code' => $client->code, 'name' => $client->name, 'own' => $client->code === ($account->client->code ?? null)] : null,
            'reference' => $terms['agency_ref'] ?? null,
            'pay_mode' => $terms['pay_mode'] ?? null,
            'price_list' => $terms['price_list'] ?? null,
            'currency' => $reservation->currency,
            'total' => ChannelKit::money($reservation->total_amount),
            'pvp' => isset($terms['pvp_total']) ? ChannelKit::money($terms['pvp_total']) : null,
            'commission' => $commission ? ['amount' => ChannelKit::money($commission->amount), 'pct' => (float) $commission->pct, 'currency' => $commission->currency, 'status' => $commission->status] : null,
            'editable' => ! $closed,
            'days' => $services->groupBy('service_date')->map(fn (Collection $group, string $date): array => [
                'date' => $date,
                'number' => (int) Carbon::parse($reservation->travel_from)->diffInDays(Carbon::parse($date), false) + 1,
                'services' => $group->map(fn (object $row): array => [
                    'code' => $row->code,
                    'name' => $row->name,
                    'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
                    'kind' => $row->service_kind,
                    'status' => $row->status,
                    'pax' => (int) $row->pax,
                    'confirmation' => $row->confirmation_code,
                ])->values(),
            ])->values(),
            'passengers' => $passengers->map(fn (object $row): array => [
                'seq' => (int) $row->seq,
                'name' => $row->full_name,
                'type' => $row->pax_type,
                'doc_type' => $row->doc_type,
                'doc_number' => $row->doc_number,
                'nationality' => $row->nationality,
                'birth_date' => $row->birth_date,
                'lead' => (bool) $row->is_lead,
                'missing' => (bool) $row->is_placeholder || (bool) $row->pending || ! $row->doc_number,
            ])->values(),
            'vouchers' => $vouchers->map(fn (object $row): array => ['code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version, 'pax' => (int) $row->pax, 'issued_at' => $row->issued_at])->values(),
            'billing' => [
                'amount' => ChannelKit::money($amount),
                'paid' => ChannelKit::money($paid),
                'balance' => ChannelKit::money($amount - $paid),
                'currency' => $receivables->first()->currency ?? $reservation->currency,
                'installments' => $receivables->map(fn (object $row): array => [...$this->installment($row, $reservation->code, $account->today), 'reported' => $reported[$row->code] ?? 0])->values(),
                'payments' => $payments,
            ],
            'methods' => $this->methodOptions(),
            'cancel' => [
                'allowed' => ! $closed && ($request?->status !== 'pendiente'),
                'reasons' => ReservationWorkflow::CANCEL_REASONS,
                'request' => $request ? ['reason' => $request->reason, 'status' => $request->status, 'requested_at' => $request->requested_at, 'decided_at' => $request->decided_at, 'note' => $request->decision_note] : null,
            ],
            'doc_types' => ['DNI', 'Pasaporte', 'CE'],
        ];
    }

    public function statement(B2bAccount $account): array
    {
        $today = $account->today;
        $receivables = $this->receivables($account);
        $reported = $this->reported($receivables->pluck('code')->all());
        $commissions = $this->commissions($account);
        $live = $receivables->whereIn('status', self::LIVE_RECEIVABLE);
        $settlements = DB::table('channel_b2b_settlement_requests')->where('agency_id', $account->agency->id)->orderByDesc('created_at')->get(['code', 'amount_pen', 'status', 'created_at', 'commission_ids']);

        return [
            'today' => $today,
            'credit' => $this->credit($account),
            'kpis' => [
                'billed' => $this->money($receivables),
                'paid' => $this->money($receivables, 'paid_amount'),
                'due' => $live->groupBy('currency')->map(fn (Collection $rows): float => ChannelKit::money($rows->sum(fn (object $row): float => (float) $row->amount - (float) $row->paid_amount)))->all(),
                'overdue' => $live->filter(fn (object $row): bool => $row->due_date < $today)->count(),
                'commission_pending' => $this->money($commissions->whereIn('status', ['calculada', 'aprobada'])),
                'commission_paid' => $this->money($commissions->where('status', 'pagada')),
            ],
            'installments' => $receivables->map(fn (object $row): array => [
                ...$this->installment($row, $row->reservation, $today),
                'reservation_title' => $row->reservation_title,
                'reported' => $reported[$row->code] ?? 0,
            ])->values(),
            'payments' => $this->payments(DB::table('fin_payments as p')->whereIn('p.reservation_id', $account->reservations()->select('id'))),
            'commissions' => $commissions->map(fn ($row): array => [
                'code' => $row->code,
                'reservation' => $row->reservation,
                'reservation_title' => $row->reservation_title,
                'base' => ChannelKit::money($row->base_amount),
                'pct' => (float) $row->pct,
                'amount' => ChannelKit::money($row->amount),
                'currency' => $row->currency,
                'status' => $row->status,
                'requested' => $row->settlement_request_id !== null,
                'paid_at' => $row->paid_at,
                'created_at' => $row->created_at,
            ])->values(),
            'settlements' => $settlements->map(fn (object $row): array => ['code' => $row->code, 'amount' => ChannelKit::money($row->amount_pen), 'status' => $row->status, 'created_at' => $row->created_at, 'count' => count(array_filter(explode(',', trim((string) $row->commission_ids, '{}'))))])->values(),
            'can_settle' => $commissions->whereIn('status', ['calculada', 'aprobada'])->whereNull('settlement_request_id')->isNotEmpty(),
            'methods' => $this->methodOptions(),
        ];
    }

    public function agency(B2bAccount $account): array
    {
        $agency = $account->agency;
        $owner = $account->client?->owner_id ? DB::table('iam_users')->where('id', $account->client->owner_id)->first(['name', 'email', 'phone', 'avatar_color']) : null;
        $users = DB::table('iam_users')->where('agency_id', $agency->id)->whereNull('deleted_at')->orderBy('name')->get(['code', 'name', 'email', 'phone', 'status', 'last_login_at', 'avatar_color']);

        return [
            'agency' => [
                ...$this->agencyCard($account),
                'ruc' => $agency->ruc,
                'contact' => $agency->contact_name,
                'email' => $agency->booking_email,
                'price_list' => DB::table('channel_b2b_price_lists')->where('id', $agency->price_list_id)->value('name'),
                'commission_pct' => (float) $agency->commission_pct,
                'valid_from' => $agency->valid_from,
                'valid_to' => $agency->valid_to,
                'client' => $account->client ? ['code' => $account->client->code, 'name' => $account->client->name] : null,
            ],
            'credit' => $this->credit($account),
            'rates' => $this->catalog->products($account)->whereNotNull('net')->count(),
            'manager' => $owner ? ['name' => $owner->name, 'email' => $owner->email, 'phone' => $owner->phone, 'color' => $owner->avatar_color] : null,
            'users' => $users->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'email' => $row->email, 'phone' => $row->phone, 'status' => $row->status, 'last_login_at' => $row->last_login_at, 'color' => $row->avatar_color, 'me' => $row->email === $account->user->email])->values(),
            'movements' => DB::table('channel_b2b_credit_movements as m')->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')->where('m.agency_id', $agency->id)->orderByDesc('m.created_at')->limit(12)
                ->get(['m.movement_type', 'm.amount', 'm.currency', 'm.balance_after', 'm.note', 'm.created_at', 'r.code as reservation'])
                ->map(fn (object $row): array => ['type' => $row->movement_type, 'amount' => ChannelKit::money($row->amount), 'currency' => $row->currency, 'balance' => ChannelKit::money($row->balance_after), 'note' => $row->note, 'at' => $row->created_at, 'reservation' => $row->reservation])->values(),
        ];
    }

    private function agencyCard(B2bAccount $account): array
    {
        $words = preg_split('/\s+/', trim((string) preg_replace('/\b(S\.?A\.?C?\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?)/u', '', (string) $account->agency->legal_name))) ?: [];

        return [
            'code' => $account->agency->code,
            'name' => $account->agency->legal_name,
            'initials' => mb_strtoupper(mb_substr($words[0] ?? 'A', 0, 1).mb_substr($words[1] ?? '', 0, 1)),
            'status' => $account->status(),
            'block_reason' => $account->agency->block_reason,
            'valid_to' => $account->agency->valid_to,
        ];
    }

    private function credit(B2bAccount $account): array
    {
        return [
            'currency' => $account->agency->credit_currency,
            'limit' => $account->limit(),
            'used' => $account->used(),
            'available' => $account->available(),
            'pct' => $account->usagePct(),
            'status' => $account->status(),
            'block' => $account->creditBlock(),
            'can_book' => $account->bookingBlock() === null,
            'commission_pct' => (float) $account->agency->commission_pct,
        ];
    }

    private function alerts(B2bAccount $account): array
    {
        $today = $account->today;
        $soon = Carbon::parse($today)->addDays(7)->toDateString();
        $alerts = collect();

        if ($account->status() === 'bloqueada') {
            $alerts->push(['kind' => 'block', 'tone' => 'bad', 'title' => 'Línea de crédito bloqueada', 'detail' => $account->agency->block_reason === 'credito_excedido' ? 'El crédito utilizado superó el límite. Informa tus pagos para liberarla.' : 'Finanzas bloqueó la línea. Puedes seguir reservando con prepago.', 'amount' => null, 'currency' => null, 'date' => null, 'href' => '/agencia/cuenta']);
        } elseif ($account->bookingBlock() !== null) {
            $alerts->push(['kind' => 'block', 'tone' => 'bad', 'title' => 'Convenio vencido', 'detail' => $account->bookingBlock(), 'amount' => null, 'currency' => null, 'date' => $account->agency->valid_to, 'href' => '/agencia/mi-agencia']);
        } elseif ($account->agency->valid_to <= Carbon::parse($today)->addDays(30)->toDateString()) {
            $alerts->push(['kind' => 'block', 'tone' => 'warn', 'title' => 'Convenio por vencer', 'detail' => 'Coordina la renovación para seguir reservando sin interrupciones.', 'amount' => null, 'currency' => null, 'date' => $account->agency->valid_to, 'href' => '/agencia/mi-agencia']);
        }

        if (($account->usagePct() ?? 0) >= B2bAccount::CREDIT_ALERT_PCT && $account->status() !== 'bloqueada') {
            $alerts->push(['kind' => 'credit', 'tone' => 'warn', 'title' => 'Crédito al límite', 'detail' => "Usas el {$account->usagePct()} % de tu línea. Informa pagos para liberar crédito.", 'amount' => $account->available(), 'currency' => $account->agency->credit_currency, 'date' => null, 'href' => '/agencia/cuenta']);
        }

        foreach ($this->receivables($account)->whereIn('status', self::LIVE_RECEIVABLE)->filter(fn (object $row): bool => $row->due_date <= $soon) as $row) {
            $alerts->push(['kind' => 'payment', 'tone' => $row->due_date < $today ? 'bad' : 'warn', 'title' => $row->due_date < $today ? 'Cuota vencida' : 'Cuota por vencer', 'detail' => "{$row->concept} · {$row->reservation}", 'amount' => ChannelKit::money((float) $row->amount - (float) $row->paid_amount), 'currency' => $row->currency, 'date' => $row->due_date, 'href' => '/agencia/cuenta']);
        }

        $pending = $account->reservations()->whereNotIn('status', ReservationWorkflow::CLOSED)->where('travel_from', '>=', $today)->where('travel_from', '<=', Carbon::parse($today)->addDays(15)->toDateString())->get(['id', 'code', 'title', 'travel_from']);
        $pax = $this->paxCounts($pending->pluck('id')->all());

        foreach ($pending as $row) {
            if (($pax[$row->id]['pending'] ?? 0) > 0) {
                $alerts->push(['kind' => 'names', 'tone' => 'info', 'title' => 'Pasajeros por nominar', 'detail' => ($pax[$row->id]['pending'] === 1 ? '1 pasajero' : "{$pax[$row->id]['pending']} pasajeros")." sin datos en {$row->title}", 'amount' => null, 'currency' => null, 'date' => $row->travel_from, 'href' => "/agencia/reservas/{$row->code}"]);
            }
        }

        return $alerts->values()->all();
    }

    private function receivables(B2bAccount $account): Collection
    {
        return DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->whereIn('f.reservation_id', $account->reservations()->select('id'))
            ->whereNull('f.deleted_at')->where('f.status', '<>', 'cancelada')->orderBy('f.due_date')
            ->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'r.code as reservation', 'r.title as reservation_title']);
    }

    private function commissions(B2bAccount $account): Collection
    {
        return DB::table('fin_commissions as c')->leftJoin('booking_reservations as r', 'r.id', '=', 'c.reservation_id')
            ->where('c.beneficiary_agency_id', $account->agency->id)->whereNull('c.deleted_at')->orderByDesc('c.created_at')
            ->get(['c.code', 'c.base_amount', 'c.pct', 'c.amount', 'c.currency', 'c.status', 'c.paid_at', 'c.created_at', 'c.settlement_request_id', 'r.code as reservation', 'r.title as reservation_title']);
    }

    private function reported(array $codes): array
    {
        $totals = [];

        foreach (DB::table('fin_payments as p')->join('fin_receivables as f', 'f.id', '=', 'p.receivable_id')->whereIn('f.code', $codes)->where('p.status', 'pendiente')
            ->selectRaw('f.code, sum(p.amount) as total')->groupBy('f.code')->get() as $row) {
            $totals[$row->code] = ChannelKit::money($row->total);
        }

        return $totals;
    }

    private function money(Collection $rows, string $column = 'amount'): array
    {
        return $rows->groupBy('currency')->map(fn (Collection $group): float => ChannelKit::money($group->sum(fn (object $row): float => (float) $row->{$column})))->all();
    }

    private function paxCounts(array $ids): array
    {
        return DB::table('booking_passengers')->whereIn('reservation_id', $ids)
            ->selectRaw('reservation_id, count(*) as total, sum(case when is_placeholder or pending or doc_number is null then 1 else 0 end) as pending')
            ->groupBy('reservation_id')->get()
            ->mapWithKeys(fn (object $row): array => [$row->reservation_id => ['total' => (int) $row->total, 'pending' => (int) $row->pending]])->all();
    }

    private function terms(object $reservation): array
    {
        return is_string($reservation->b2b_terms ?? null) ? (array) json_decode($reservation->b2b_terms, true) : [];
    }

    private function installment(object $row, ?string $reservation, string $today): array
    {
        $balance = ChannelKit::money((float) $row->amount - (float) $row->paid_amount);

        return [
            'code' => $row->code,
            'concept' => $row->concept,
            'reservation' => $reservation,
            'amount' => ChannelKit::money($row->amount),
            'paid' => ChannelKit::money($row->paid_amount),
            'balance' => $balance,
            'currency' => $row->currency,
            'due_date' => $row->due_date,
            'status' => $row->status,
            'overdue' => $balance > 0 && $row->due_date < $today,
        ];
    }

    private function payments($query): Collection
    {
        $labels = $this->methods->labels();

        return $query->leftJoin('fin_receivables as f', 'f.id', '=', 'p.receivable_id')->leftJoin('booking_reservations as rr', 'rr.id', '=', 'p.reservation_id')
            ->where('p.kind', 'cobro')->orderByDesc('p.paid_on')->orderByDesc('p.created_at')
            ->get(['p.code', 'p.method', 'p.amount', 'p.currency', 'p.paid_on', 'p.status', 'p.source', 'p.reference', 'p.reject_reason', 'f.code as receivable', 'f.concept', 'rr.code as reservation'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'method' => $labels[$row->method] ?? $row->method,
                'amount' => ChannelKit::money($row->amount),
                'currency' => $row->currency,
                'paid_on' => $row->paid_on,
                'status' => $row->status,
                'source' => $row->source,
                'reference' => $row->reference,
                'reject_reason' => $row->reject_reason,
                'receivable' => $row->receivable,
                'concept' => $row->concept,
                'reservation' => $row->reservation,
            ])->values();
    }

    private function methodOptions(): array
    {
        return collect($this->methods->options())->reject(fn (array $method): bool => $method['b2b'] || $method['value'] === 'efectivo')->values()->all();
    }
}
