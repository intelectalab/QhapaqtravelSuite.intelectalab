<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\CustomerPortalPreview;
use App\Domain\Crm\Actions\ArcoRequests;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PortalDirectory
{
    private const LIVE = ['enviada', 'vista', 'negociacion'];

    private const CLOSED = ['cancelada', 'completada'];

    public function __construct(
        private readonly CustomerPortalPreview $preview,
        private readonly ChannelKit $kit,
        private readonly PaymentMethods $methods,
        private readonly TenantContext $context,
    ) {}

    public function session(PortalAccount $account): array
    {
        $tenant = $this->context->tenant();
        $awaiting = $account->isPassenger() ? 0 : DB::table('quote_quotes')->where('client_id', $account->client->id)->whereNull('deleted_at')->whereIn('status', self::LIVE)->where('valid_until', '>=', $this->kit->today())->count();

        return [
            'role' => $account->role,
            'agency' => ['name' => $tenant->commercial_name, 'initials' => $tenant->logo_initials, 'email' => $tenant->email ?? null, 'phone' => $tenant->phone ?? null],
            'client' => ['code' => $account->client->code, 'name' => $account->client->name, 'email' => $account->client->email],
            'user' => ['name' => $account->user->name, 'email' => $account->user->email, 'color' => $account->user->avatar_color],
            'trip' => $account->isPassenger() ? $account->reservations()->first()?->code : null,
            'counts' => ['quotes' => $awaiting, 'trips' => $account->reservations()->count()],
        ];
    }

    public function documents(PortalAccount $account): array
    {
        return app(PortalDocuments::class)->list($account);
    }

    public function paymentHistory(PortalAccount $account): array
    {
        return ['items' => $this->billing($account)['payments']];
    }

    public function notifications(PortalAccount $account): array
    {
        $rows = DB::table('notif_messages')
            ->where(fn ($query) => $query->where('recipient_user_id', $account->user->getKey())->orWhere(fn ($inner) => $inner->where('client_id', $account->client->id)->whereIn('audience', ['client', 'passenger'])))
            ->where('status', '<>', 'fallido')
            ->orderByDesc('created_at')->limit(50)
            ->get(['id', 'event_code', 'channel', 'subject', 'body_rendered', 'created_at']);
        $items = [];

        foreach ($rows as $row) {
            $items[] = ['id' => $row->id, 'event' => $row->event_code, 'channel' => $row->channel, 'subject' => $row->subject, 'body' => $row->body_rendered, 'at' => $row->created_at];
        }

        return ['items' => $items];
    }

    public function home(PortalAccount $account): array
    {
        $today = $this->kit->today();
        $base = $this->base($account, $today);
        $reservations = $account->reservations();
        $next = $reservations->filter(fn (object $row): bool => $row->travel_to >= $today && ! in_array($row->status, self::CLOSED, true))->sortBy('travel_from')->first();

        return [
            'today' => $today,
            'advisor' => $base['advisor'],
            'next_trip' => $next ? $this->nextTrip($next, $today) : null,
            'alerts' => $this->alerts($account, $base, $reservations, $today),
            'trips' => $base['reservations'],
            'quotes' => collect($base['quotes'])->whereIn('status', self::LIVE)->where('expired', false)->values(),
            'balance' => $base['kpis']['balance'],
            'documents' => count($base['documents']),
            'banners' => app(PortalContent::class)->for(PortalContent::audience($account), ['Banner', 'Landing']),
        ];
    }

    public function trips(PortalAccount $account): array
    {
        $today = $this->kit->today();
        $base = $this->base($account, $today);

        return [
            'today' => $today,
            'trips' => collect($base['reservations'])->map(fn (array $row): array => [...$row, 'phase' => $this->phase($row['status'], $row['from'], $row['to'], $today)])->values(),
        ];
    }

    public function trip(PortalAccount $account, string $code): array
    {
        $today = $this->kit->today();
        $reservation = $account->reservation($code);
        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'rechazado'])->whereNull('replaced_by_id')
            ->orderBy('service_date')->orderByRaw('service_time nulls last')->orderBy('code')
            ->get(['code', 'name', 'service_date', 'service_time', 'service_kind', 'status', 'pax', 'nights', 'confirmation_code']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')
            ->get(['seq', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'nationality', 'birth_date', 'is_lead', 'is_placeholder', 'pending']);
        $vouchers = DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', '<>', 'anulado')->orderBy('service_date')
            ->get(['code', 'service_label', 'service_date', 'status', 'version', 'pax']);
        $invoices = $account->isPassenger() ? collect() : DB::table('fin_invoices')->where('reservation_id', $reservation->id)->whereNotIn('status', ['pendiente_envio', 'anulado'])->orderBy('issue_date')
            ->get(['number', 'doc_type', 'issue_date', 'total_amount', 'currency', 'status']);
        $receivables = $account->isPassenger() ? collect() : DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->orderBy('due_date')
            ->get(['code', 'concept', 'amount', 'paid_amount', 'currency', 'due_date', 'status']);
        $payments = $account->isPassenger() ? collect() : $this->payments(DB::table('fin_payments as p')->where('p.reservation_id', $reservation->id));
        $notices = $account->isPassenger() ? DB::table('notif_pax_messages')->where('reservation_id', $reservation->id)->whereIn('status', ['enviado', 'entregado', 'leido', 'fallido'])->orderByDesc('sent_at')
            ->get(['code', 'subject', 'body', 'sent_at', 'channel']) : collect();
        $amount = (float) $receivables->sum('amount');
        $paid = (float) $receivables->sum('paid_amount');

        return [
            'today' => $today,
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'phase' => $this->phase($reservation->status, $reservation->travel_from, $reservation->travel_to, $today),
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'currency' => $reservation->currency,
            'total' => $account->isPassenger() ? null : ChannelKit::money($reservation->total_amount),
            'days_left' => Carbon::parse($today)->diffInDays(Carbon::parse($reservation->travel_from), false),
            'advisor' => $this->advisor($reservation->owner_id ?? $account->advisorId()),
            'progress' => ['services' => $services->count(), 'confirmed' => $services->whereIn('status', ['confirmado', 'en_curso', 'completado'])->count()],
            'days' => $services->groupBy('service_date')->map(fn (Collection $group, string $date): array => [
                'date' => $date,
                'number' => (int) Carbon::parse($reservation->travel_from)->diffInDays(Carbon::parse($date), false) + 1,
                'services' => $group->map(fn (object $row): array => [
                    'code' => $row->code,
                    'name' => $row->name,
                    'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
                    'kind' => $row->service_kind,
                    'status' => $row->status,
                    'state' => self::serviceState($row, $today, (string) $reservation->travel_to),
                    'pax' => (int) $row->pax,
                    'nights' => $row->nights !== null ? (int) $row->nights : null,
                    'confirmation' => $row->confirmation_code,
                ])->values(),
            ])->values(),
            'passengers' => $passengers->map(fn (object $row): array => [
                'seq' => (int) $row->seq,
                'name' => $row->full_name,
                'type' => $row->pax_type,
                'nationality' => $row->nationality,
                'document' => $row->doc_number ? trim(($row->doc_type ?? '').' ···'.substr((string) $row->doc_number, -3)) : null,
                'lead' => (bool) $row->is_lead,
                'missing' => $this->missingData($row),
            ])->values(),
            'vouchers' => $vouchers->map(fn ($row): array => ['code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version, 'pax' => (int) $row->pax])->values(),
            'invoices' => $invoices->map(fn ($row): array => ['number' => $row->number, 'type' => $row->doc_type, 'date' => $row->issue_date, 'total' => ChannelKit::money($row->total_amount), 'currency' => $row->currency, 'status' => $row->status])->values(),
            'billing' => $account->isPassenger() ? null : [
                'amount' => ChannelKit::money($amount),
                'paid' => ChannelKit::money($paid),
                'balance' => ChannelKit::money($amount - $paid),
                'currency' => $receivables->first()->currency ?? $reservation->currency,
                'installments' => $receivables->map(fn (object $row): array => $this->installment($row, $reservation->code, $today))->values(),
                'payments' => $payments,
            ],
            'notices' => $notices->map(fn ($row): array => ['code' => $row->code, 'subject' => $row->subject, 'body' => $row->body, 'sent_at' => $row->sent_at, 'channel' => $row->channel])->values(),
        ];
    }

    public function quotes(PortalAccount $account): array
    {
        $base = $this->base($account, $this->kit->today());

        return ['quotes' => collect($base['quotes'])->map(fn (array $row): array => [...$row, 'can_decide' => in_array($row['status'], self::LIVE, true) && ! $row['expired']])->values()];
    }

    public function quote(PortalAccount $account, string $code): array
    {
        $quote = $account->quote($code);
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first(['id', 'version_no', 'issued_on', 'conditions', 'grand_total', 'tax_total', 'discount_total', 'currency']);
        $items = $version ? DB::table('quote_items as i')->leftJoin('catalog_products as p', 'p.id', '=', 'i.product_id')->where('i.quote_version_id', $version->id)->orderBy('i.line_no')
            ->get(['i.line_no', 'p.name', 'i.segment', 'i.service_date', 'i.qty', 'i.pax', 'i.sale_total']) : collect();
        $expired = in_array($quote->status, self::LIVE, true) && $quote->valid_until < $this->kit->today();

        return [
            'code' => $quote->code,
            'lock_version' => (int) $quote->lock_version,
            'title' => $quote->title,
            'status' => $expired ? 'vencida' : $quote->status,
            'valid_until' => $quote->valid_until,
            'travel_from' => $quote->travel_from,
            'travel_to' => $quote->travel_to,
            'currency' => $quote->currency,
            'pax' => ['adults' => (int) $quote->pax_adt, 'children' => (int) $quote->pax_chd, 'infants' => (int) $quote->pax_inf],
            'version' => $version ? (int) $version->version_no : null,
            'issued_on' => $version?->issued_on,
            'conditions' => $version?->conditions,
            'total' => $version ? ChannelKit::money($version->grand_total) : null,
            'tax' => $version ? ChannelKit::money($version->tax_total) : null,
            'discount' => $version ? ChannelKit::money($version->discount_total) : null,
            'items' => $items->map(fn ($row): array => ['line' => (int) $row->line_no, 'name' => $row->name ?? $row->segment, 'segment' => $row->segment, 'date' => $row->service_date, 'qty' => (float) $row->qty, 'pax' => (int) $row->pax, 'total' => ChannelKit::money($row->sale_total)])->values(),
            'approval' => $quote->approved_at ? ['at' => $quote->approved_at, 'by' => $quote->approved_by_name, 'channel' => $quote->approval_channel] : null,
            'rejection' => $quote->rejected_at ? ['at' => $quote->rejected_at, 'reason' => $quote->rejected_reason] : null,
            'can_decide' => in_array($quote->status, self::LIVE, true) && ! $expired,
            'advisor' => $this->advisor($quote->owner_id),
        ];
    }

    public function billing(PortalAccount $account): array
    {
        $today = $this->kit->today();
        $base = $this->base($account, $today);
        $receivables = DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->where('f.client_id', $account->client->id)->whereNull('f.deleted_at')->where('f.status', '<>', 'cancelada')->orderBy('f.due_date')
            ->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'r.code as reservation', 'r.title as reservation_title']);
        $pending = DB::table('fin_payments')->whereIn('receivable_id', DB::table('fin_receivables')->where('client_id', $account->client->id)->select('id'))->where('status', 'pendiente')->selectRaw('receivable_id, sum(amount) as total')->groupBy('receivable_id')->pluck('total', 'receivable_id');
        $ids = DB::table('fin_receivables')->where('client_id', $account->client->id)->pluck('id', 'code');

        return [
            'today' => $today,
            'balance' => $base['kpis']['balance'],
            'installments' => $receivables->map(fn (object $row): array => [
                ...$this->installment($row, $row->reservation, $today),
                'reservation_title' => $row->reservation_title,
                'reported' => ChannelKit::money($pending[$ids[$row->code] ?? ''] ?? 0),
            ])->values(),
            'payments' => $this->payments(DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->where('r.client_id', $account->client->id)),
            'methods' => collect($this->methods->options())->reject(fn (array $method): bool => $method['b2b'] || $method['value'] === 'efectivo')->values(),
        ];
    }

    public function profile(PortalAccount $account): array
    {
        $client = $account->client;
        $consents = DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $client->id)->get(['channel', 'status', 'granted_at', 'revoked_at', 'source', 'policy_version'])->keyBy('channel');
        $claims = DB::table('crm_cases as c')->leftJoin('booking_reservations as r', 'r.id', '=', 'c.reservation_id')->where('c.client_id', $client->id)->where('c.is_book', true)->orderByDesc('c.received_at')
            ->leftJoin('iam_sedes as s', 's.id', '=', 'c.sede_id')
            ->get(['c.code', 'c.book_number', 'c.type_code', 'c.status', 'c.book_status', 'c.received_at', 'c.due_date', 'c.subject', 'c.detail', 'c.request', 'c.response', 'c.response_days', 'c.consumer', 'c.good', 's.name as sede', 'r.code as reservation']);
        $arco = DB::table('crm_cases')->where('client_id', $client->id)->where('type_code', ArcoRequests::CASE_TYPE)->when($account->isPassenger(), fn ($query) => $query->whereRaw('false'))
            ->orderByDesc('created_at')->limit(10)->get(['code', 'subject', 'status', 'due_date', 'created_at', 'resolution']);

        return [
            'client' => [
                'code' => $client->code,
                'name' => $client->name,
                'kind' => $client->kind,
                'document' => $client->doc_number ? trim(($client->doc_type ?? '').' '.$client->doc_number) : null,
                'email' => $client->email,
                'phone' => $client->phone,
                'country' => $client->country,
                'city' => $client->city,
                'birth_date' => $client->birth_date,
            ],
            'login_email' => $account->user->email,
            'locale' => $account->user->locale ?? 'es',
            'editable' => ! $account->isPassenger(),
            'consents' => collect(['email', 'whatsapp'])->map(fn (string $channel): array => [
                'channel' => $channel,
                'granted' => ($consents[$channel]->status ?? null) === 'otorgado',
                'since' => ($consents[$channel]->status ?? null) === 'otorgado' ? $consents[$channel]->granted_at : ($consents[$channel]->revoked_at ?? null),
                'source' => $consents[$channel]->source ?? null,
                'policy' => $consents[$channel]->policy_version ?? null,
            ])->values(),
            'claims' => $account->isPassenger() ? [] : $claims->map(fn (object $row): array => [
                'code' => $row->code,
                'number' => $row->book_number,
                'type' => $row->type_code,
                'status' => $row->status,
                'received_at' => $row->received_at,
                'due_date' => $row->due_date,
                'subject' => $row->subject,
                'reservation' => $row->reservation,
                'book_status' => $row->book_status,
                'response' => $this->claimResponse($row->response),
                'receipt' => $this->claimReceipt($row),
            ])->values(),
            'claims_book' => '/sitio/'.$this->context->tenant()->subdomain.'/libro-reclamaciones',
            'arco_requests' => $arco->map(fn (object $row): array => [
                'code' => $row->code,
                'subject' => $row->subject,
                'status' => $row->status,
                'due_date' => $row->due_date,
                'created_at' => $row->created_at,
                'resolution' => $row->resolution,
            ])->values(),
        ];
    }

    public function messages(PortalAccount $account): array
    {
        $conversations = DB::table('collab_conversations as c')->leftJoin('booking_reservations as r', 'r.id', '=', 'c.reservation_id')->leftJoin('iam_users as u', 'u.id', '=', 'c.assignee_id')
            ->where('c.channel', 'portal')->where('c.client_id', $account->client->id)
            ->when($account->reservationId, fn ($query) => $query->where('c.reservation_id', $account->reservationId))
            ->orderByDesc('c.last_message_at')
            ->get(['c.id', 'c.code', 'c.subject', 'c.status', 'c.last_message_at', 'r.code as reservation', 'u.name as assignee']);
        $messages = DB::table('collab_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.author_user_id')->whereIn('m.conversation_id', $conversations->pluck('id'))->whereIn('m.direction', ['in', 'out'])->orderBy('m.sent_at')
            ->get(['m.conversation_id', 'm.direction', 'm.body', 'm.sent_at', 'u.name as author'])->groupBy('conversation_id');

        return [
            'advisor' => $this->advisor($account->advisorId()),
            'trips' => $account->reservations()->map(fn ($row): array => ['code' => $row->code, 'title' => $row->title])->values(),
            'conversations' => $conversations->map(fn ($row): array => [
                'code' => $row->code,
                'subject' => $row->subject,
                'status' => $row->status,
                'last_message_at' => $row->last_message_at,
                'reservation' => $row->reservation,
                'assignee' => $row->assignee,
                'messages' => collect($messages[$row->id] ?? [])->map(fn ($message): array => ['mine' => $message->direction === 'in', 'author' => $message->direction === 'in' ? null : $message->author, 'body' => $message->body, 'at' => $message->sent_at])->values(),
            ])->values(),
        ];
    }

    private function base(PortalAccount $account, string $today): array
    {
        $base = $this->preview->portal($account->client, $today);

        if (! $account->isPassenger()) {
            return $base;
        }

        $codes = $account->reservations()->pluck('code')->all();

        return [
            ...$base,
            'reservations' => collect($base['reservations'])->whereIn('code', $codes)->map(fn (array $row): array => [...$row, 'total' => null])->values()->all(),
            'quotes' => [],
            'payments' => [],
            'documents' => collect($base['documents'])->whereIn('reservation', $codes)->values()->all(),
            'kpis' => [...$base['kpis'], 'balance' => [], 'awaiting_quotes' => 0],
        ];
    }

    private function nextTrip(object $row, string $today): array
    {
        $services = DB::table('booking_reservation_services')->where('reservation_id', $row->id)->whereNotIn('status', ['cancelado', 'rechazado'])->whereNull('replaced_by_id')->get(['status', 'service_date']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $row->id)->count();
        $from = Carbon::parse($row->travel_from);
        $to = Carbon::parse($row->travel_to);
        $now = Carbon::parse($today);

        return [
            'code' => $row->code,
            'title' => $row->title,
            'status' => $row->status,
            'from' => $row->travel_from,
            'to' => $row->travel_to,
            'days_left' => (int) $now->diffInDays($from, false),
            'nights' => (int) $from->diffInDays($to),
            'day_number' => $now->betweenIncluded($from, $to) ? (int) $from->diffInDays($now) + 1 : null,
            'passengers' => $passengers,
            'services' => $services->count(),
            'confirmed' => $services->whereIn('status', ['confirmado', 'en_curso', 'completado'])->count(),
            'next_service' => DB::table('booking_reservation_services')->where('reservation_id', $row->id)->whereNotIn('status', ['cancelado', 'rechazado', 'completado'])->whereNull('replaced_by_id')->where('service_date', '>=', $today)
                ->orderBy('service_date')->orderByRaw('service_time nulls last')->first(['name', 'service_date', 'service_time']),
        ];
    }

    private function alerts(PortalAccount $account, array $base, Collection $reservations, string $today): array
    {
        $soon = Carbon::parse($today)->addDays(10)->toDateString();
        $alerts = collect($base['payments'])
            ->filter(fn (array $row): bool => $row['balance'] > 0 && $row['due_date'] <= $soon)
            ->map(fn (array $row): array => [
                'kind' => 'payment',
                'tone' => $row['due_date'] < $today ? 'bad' : 'warn',
                'title' => $row['due_date'] < $today ? 'Cuota vencida' : 'Cuota por vencer',
                'detail' => "{$row['concept']} · {$row['reservation']}",
                'amount' => $row['balance'],
                'currency' => $row['currency'],
                'date' => $row['due_date'],
                'href' => '/portal/pagos',
            ]);

        foreach ($reservations->filter(fn (object $row): bool => $row->travel_to >= $today && ! in_array($row->status, self::CLOSED, true)) as $reservation) {
            $missing = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->get(['doc_number', 'is_placeholder', 'pending', 'birth_date'])->filter(fn (object $row): bool => $this->missingData($row))->count();
            if ($missing > 0) {
                $alerts->push(['kind' => 'document', 'tone' => 'info', 'title' => 'Faltan datos de pasajeros', 'detail' => "{$missing} ".($missing === 1 ? 'pasajero sin documento' : 'pasajeros sin documento')." en {$reservation->title}", 'amount' => null, 'currency' => null, 'date' => $reservation->travel_from, 'href' => "/portal/viajes/{$reservation->code}"]);
            }
        }

        foreach (collect($base['quotes'])->whereIn('status', self::LIVE)->where('expired', false) as $quote) {
            $alerts->push(['kind' => 'quote', 'tone' => 'violet', 'title' => 'Propuesta por responder', 'detail' => $quote['title'], 'amount' => $quote['total'], 'currency' => $quote['currency'], 'date' => $quote['valid_until'], 'href' => "/portal/propuestas/{$quote['code']}"]);
        }

        return $alerts->sortBy('date')->values()->all();
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

        return $query->leftJoin('fin_receivables as f', 'f.id', '=', 'p.receivable_id')->where('p.kind', 'cobro')->orderByDesc('p.paid_on')->orderByDesc('p.created_at')
            ->get(['p.code', 'p.method', 'p.amount', 'p.currency', 'p.paid_on', 'p.status', 'p.source', 'p.reference', 'p.reject_reason', 'f.code as receivable', 'f.concept'])
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
            ])->values();
    }

    private function advisor(?string $id): ?array
    {
        $row = $id ? DB::table('iam_users')->where('id', $id)->first(['name', 'email', 'phone', 'avatar_color']) : null;

        return $row ? ['name' => $row->name, 'email' => $row->email, 'phone' => $row->phone, 'color' => $row->avatar_color] : null;
    }

    private function missingData(object $row): bool
    {
        return (bool) $row->is_placeholder || (bool) $row->pending || ! $row->doc_number;
    }

    public static function serviceState(object $row, string $today, string $tripEnd): string
    {
        $date = (string) $row->service_date;
        $until = match (true) {
            $row->service_kind !== 'alojamiento' => $date,
            (bool) $row->nights => Carbon::parse($date)->addDays((int) $row->nights)->toDateString(),
            default => max($date, $tripEnd),
        };

        return match (true) {
            $row->status === 'completado' || $until < $today => 'completado',
            $row->service_kind === 'alojamiento' && $date <= $today && $today < $until => 'en_curso',
            $date === $today => 'hoy',
            default => 'proximo',
        };
    }

    private function phase(string $status, string $from, string $to, string $today): string
    {
        return match (true) {
            $status === 'cancelada' => 'cancelado',
            $status === 'completada' || $to < $today => 'pasado',
            $from <= $today => 'en_curso',
            default => 'proximo',
        };
    }

    private function claimResponse(mixed $value): ?array
    {
        $response = json_decode((string) $value, true);

        if (! is_array($response) || ($response['text'] ?? null) === null) {
            return null;
        }

        return ['decision' => $response['decision'] ?? null, 'text' => (string) $response['text'], 'actions' => $response['actions'] ?? null, 'answered_at' => $response['answered_at'] ?? null];
    }

    private function claimReceipt(object $row): array
    {
        $consumer = ClaimConsumer::read(json_decode((string) $row->consumer, true) ?: []);
        $good = json_decode((string) $row->good, true) ?: [];

        return [
            'agency' => (string) ($this->context->tenant()->commercial_name ?? ''),
            'sede' => $row->sede,
            'response_days' => $row->response_days === null ? null : (int) $row->response_days,
            'consumer' => ['name' => $consumer['name'] ?? null, 'document' => trim(strtoupper((string) ($consumer['doc_type'] ?? '')).' '.($consumer['doc_number'] ?? '')) ?: null, 'email' => $consumer['email'] ?? null],
            'good' => ['kind' => $good['kind'] ?? null, 'description' => $good['description'] ?? null, 'amount' => isset($good['amount']) ? (float) $good['amount'] : null, 'currency' => $good['currency'] ?? null],
            'detail' => (string) $row->detail,
            'request' => (string) $row->request,
        ];
    }
}
