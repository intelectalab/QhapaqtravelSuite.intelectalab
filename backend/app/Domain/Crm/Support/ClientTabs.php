<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ClientTabs
{
    private ?string $only = null;

    public static function partialFor(object $client, User $viewer): ?string
    {
        return Portfolio::ownOnly($viewer) && (string) $client->owner_id !== (string) $viewer->getKey() ? (string) $viewer->getKey() : null;
    }

    public function scopedTo(?string $userId): self
    {
        $copy = clone $this;
        $copy->only = $userId;

        return $copy;
    }

    public const TABS = ['leads', 'opportunities', 'quotes', 'reservations', 'passengers', 'receivables', 'payments', 'invoices', 'vouchers', 'communications', 'activities', 'timeline', 'audit'];

    public function read(object $client, string $tab, User $viewer): Collection|array
    {
        if (self::partialFor($client, $viewer) !== null && $this->only === null) {
            return $this->scopedTo(self::partialFor($client, $viewer))->read($client, $tab, $viewer);
        }

        return match ($tab) {
            'leads' => $this->leads($client->id),
            'opportunities' => $this->opportunities($client->id),
            'quotes' => $this->quotes($client->id),
            'reservations' => $this->reservations($client->id),
            'passengers' => $this->passengers($client->id),
            'receivables' => $this->receivables($client->id),
            'payments' => $this->payments($client->id),
            'invoices' => $this->invoices($client->id),
            'vouchers' => $viewer->can('operations.view') || $viewer->can('crm.clients.manage') ? $this->vouchers($client->id) : collect(),
            'communications' => $this->communications($client->id),
            'activities' => $this->activities($client->id),
            'timeline' => $this->timeline($client),
            'audit' => $this->audit($client),
            default => collect(),
        };
    }

    public function contacts(string $clientId): Collection
    {
        return DB::table('crm_client_contacts')->where('client_id', $clientId)->orderByDesc('is_primary')->orderBy('name')->get(['id', 'name', 'role', 'email', 'phone', 'is_primary']);
    }

    public function summary(object $client): array
    {
        $surveys = DB::table('crm_surveys')->where('client_id', $client->id)->whereNotNull('score')->orderByDesc('responded_at')->get(['score', 'comment', 'responded_at']);
        $destinations = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->join('catalog_products as p', 'p.id', '=', 's.product_id')->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->where('r.client_id', $client->id)->whereNull('r.deleted_at')->whereNotIn('r.status', ['borrador', 'cancelada'])
            ->selectRaw('d.name, count(distinct r.id) as trips')->groupBy('d.name')->orderByDesc('trips')->orderBy('d.name')->get()
            ->map(fn (object $row): array => ['name' => (string) $row->name, 'trips' => (int) $row->trips]);

        return [
            'open_opportunities' => DB::table('crm_opportunities')->where('client_id', $client->id)->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->when($this->only, fn ($query) => $query->where('owner_id', $this->only))
                ->orderBy('expected_close_date')->get(['code', 'title', 'stage', 'amount', 'currency', 'expected_close_date']),
            'next_activities' => $this->activityQuery($client->id)->where('a.status', '<>', 'completada')->orderBy('a.due_at')->limit(5)
                ->get(['a.code', 'a.type', 'a.subject', 'a.status', 'a.due_at', 'u.name as owner']),
            'satisfaction_detail' => $surveys->isEmpty() ? null : [
                'last' => (int) $surveys->first()->score,
                'average' => round($surveys->avg('score'), 1),
                'count' => $surveys->count(),
                'comment' => $surveys->first(fn (object $survey) => filled($survey->comment))?->comment,
            ],
            'destinations' => $destinations->values(),
            'open_cases' => DB::table('crm_cases')->where('client_id', $client->id)->whereIn('status', ['abierta', 'en_proceso'])->where('type_code', '<>', 'arco')
                ->orderByDesc('created_at')->get(['code', 'subject', 'priority', 'status']),
            'cancelled_trips' => DB::table('booking_reservations')->where('client_id', $client->id)->whereNull('deleted_at')->where('status', 'cancelada')->count(),
        ];
    }

    private function leads(string $clientId): Collection
    {
        return DB::table('crm_leads')->where(fn ($where) => $where->where('converted_client_id', $clientId)->orWhere('matched_client_id', $clientId))->whereNull('deleted_at')
            ->orderByDesc('created_at')->get(['code', 'full_name', 'source_code', 'interest_code', 'destination_label', 'score', 'status', 'created_at']);
    }

    private function opportunities(string $clientId): Collection
    {
        return DB::table('crm_opportunities as o')->leftJoin('iam_users as u', 'u.id', '=', 'o.owner_id')->where('o.client_id', $clientId)->whereNull('o.deleted_at')->when($this->only, fn ($query) => $query->where('o.owner_id', $this->only))
            ->orderByDesc('o.created_at')->get(['o.code', 'o.title', 'o.stage', 'o.amount', 'o.currency', 'o.probability', 'o.expected_close_date', 'o.closed_at', 'u.name as owner']);
    }

    private function quotes(string $clientId): Collection
    {
        return DB::table('quote_quotes as q')->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')->where('q.client_id', $clientId)->whereNull('q.deleted_at')->when($this->only, fn ($query) => $query->where('q.owner_id', $this->only))
            ->orderByDesc('q.created_at')->get(['q.code', 'q.title', 'q.status', 'q.current_version_no as version', 'q.valid_until', 'q.currency', 'v.grand_total as total', 'q.created_at']);
    }

    private function reservations(string $clientId): Collection
    {
        return DB::table('booking_reservations as r')->where('r.client_id', $clientId)->whereNull('r.deleted_at')->when($this->only, fn ($query) => $query->where('r.owner_id', $this->only))->orderByDesc('r.travel_from')
            ->selectSub(DB::table('booking_passengers as p')->whereColumn('p.reservation_id', 'r.id')->selectRaw('count(*)'), 'pax')
            ->selectSub(DB::table('fin_receivables as f')->whereColumn('f.reservation_id', 'r.id')->whereNull('f.deleted_at')->where('f.status', '<>', 'cancelada')->selectRaw('coalesce(sum(f.paid_amount), 0)'), 'paid')
            ->addSelect(['r.code', 'r.title', 'r.status', 'r.channel', 'r.travel_from', 'r.travel_to', 'r.total_amount as total', 'r.currency'])->get();
    }

    private function passengers(string $clientId): Collection
    {
        return DB::table('booking_passengers as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('r.client_id', $clientId)->whereNull('r.deleted_at')->where('r.status', '<>', 'borrador')
            ->orderBy('p.full_name')->get(['p.full_name', 'p.doc_type', 'p.doc_number', 'p.pax_type', 'p.nationality', 'p.birth_date', 'p.diet_notes', 'p.relationship', 'r.code as reservation'])
            ->groupBy(fn (object $passenger) => $passenger->doc_number ? "{$passenger->doc_type}|{$passenger->doc_number}" : mb_strtolower($passenger->full_name))
            ->map(fn (Collection $rows) => [
                'name' => $rows->first()->full_name,
                'document' => trim(($rows->first()->doc_type ?? '').' '.($rows->first()->doc_number ?? '')) ?: null,
                'pax_type' => $rows->first()->pax_type,
                'nationality' => $rows->pluck('nationality')->filter()->first(),
                'birth_date' => $rows->pluck('birth_date')->filter()->first(),
                'notes' => $rows->pluck('diet_notes')->filter()->unique()->implode(' · ') ?: null,
                'relationship' => $rows->pluck('relationship')->filter()->first(),
                'reservations' => $rows->pluck('reservation')->unique()->values(),
            ])->values();
    }

    private function receivables(string $clientId): Collection
    {
        return DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->where('f.client_id', $clientId)->whereNull('f.deleted_at')->when($this->only, fn ($query) => $query->where('r.owner_id', $this->only))
            ->orderBy('f.due_date')->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'r.code as reservation']);
    }

    private function payments(string $clientId): Collection
    {
        return DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->where('r.client_id', $clientId)->when($this->only, fn ($query) => $query->where('r.owner_id', $this->only))
            ->orderByDesc('p.paid_on')->get(['p.code', 'p.paid_on', 'p.method', 'p.reference', 'p.amount', 'p.currency', 'p.status', 'r.code as reservation']);
    }

    private function invoices(string $clientId): Collection
    {
        return DB::table('fin_invoices as i')->leftJoin('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('i.client_id', $clientId)->when($this->only, fn ($query) => $query->where('r.owner_id', $this->only))
            ->orderByDesc('i.issue_date')->get(['i.number', 'i.doc_type', 'i.issue_date', 'i.total_amount', 'i.currency', 'i.status', 'r.code as reservation']);
    }

    private function vouchers(string $clientId): Collection
    {
        return DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->leftJoin('catalog_providers as p', 'p.id', '=', 'v.provider_id')
            ->where('r.client_id', $clientId)->where('v.status', '<>', 'anulado')->when($this->only, fn ($query) => $query->where('r.owner_id', $this->only))->orderByDesc('v.service_date')
            ->get(['v.code', 'v.service_label', 'v.service_date', 'v.pax', 'v.status', 'v.version', 'p.name as provider', 'r.code as reservation']);
    }

    private function communications(string $clientId): Collection
    {
        return DB::table('notif_messages')->where('client_id', $clientId)->orderByDesc(DB::raw('coalesce(sent_at, created_at)'))->limit(100)
            ->get(['code', 'event_code', 'channel', 'recipient_address', 'subject', 'status', 'last_error', 'sent_at', 'created_at']);
    }

    private function activities(string $clientId): Collection
    {
        return $this->activityQuery($clientId)->orderByDesc('a.due_at')->limit(100)
            ->get(['a.code', 'a.type', 'a.subject', 'a.status', 'a.due_at', 'a.completed_at', 'a.related_type', 'u.name as owner']);
    }

    private function activityQuery(string $clientId): Builder
    {
        $opportunities = DB::table('crm_opportunities')->where('client_id', $clientId)->pluck('id')->all();
        $quotes = DB::table('quote_quotes')->where('client_id', $clientId)->pluck('id')->all();

        return DB::table('crm_activities as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->where(fn ($where) => $where->where(fn ($own) => $own->where('a.related_type', 'client')->where('a.related_id', $clientId))
                ->orWhere(fn ($opp) => $opp->where('a.related_type', 'opportunity')->whereIn('a.related_id', $opportunities ?: ['00000000-0000-0000-0000-000000000000']))
                ->orWhere(fn ($quote) => $quote->where('a.related_type', 'quote')->whereIn('a.related_id', $quotes ?: ['00000000-0000-0000-0000-000000000000'])))
            ->when($this->only, fn ($query) => $query->where('a.owner_id', $this->only));
    }

    private function timeline(object $client): array
    {
        $events = [self::event('alta', $client->created_at, 'Se registró como cliente', $client->code, null)];

        foreach ($this->leads($client->id) as $lead) {
            $events[] = self::event('lead', $lead->created_at, "Lead {$lead->code}", $lead->code, "/crm/leads/{$lead->code}");
        }

        foreach (DB::table('crm_opportunities')->where('client_id', $client->id)->whereNull('deleted_at')->get(['code', 'title', 'stage', 'created_at', 'closed_at']) as $opp) {
            $events[] = self::event('oportunidad', $opp->created_at, "Oportunidad: {$opp->title}", $opp->code, "/crm/oportunidades/{$opp->code}");
            if ($opp->closed_at) {
                $won = $opp->stage === 'ganada';
                $events[] = self::event($won ? 'ganada' : 'perdida', $opp->closed_at, ($won ? 'Ganó la oportunidad ' : 'Se perdió la oportunidad ').$opp->code, $opp->code, "/crm/oportunidades/{$opp->code}");
            }
        }

        foreach (DB::table('quote_quotes')->where('client_id', $client->id)->whereNull('deleted_at')->get(['code', 'title', 'created_at', 'approved_at']) as $quote) {
            $events[] = self::event('cotizacion', $quote->created_at, "Cotización: {$quote->title}", $quote->code, "/cotizaciones/{$quote->code}");
            if ($quote->approved_at) {
                $events[] = self::event('aprobacion', $quote->approved_at, "Aprobó la cotización {$quote->code}", $quote->code, "/cotizaciones/{$quote->code}");
            }
        }

        foreach (DB::table('booking_reservations')->where('client_id', $client->id)->whereNull('deleted_at')->get(['code', 'title', 'created_at']) as $reservation) {
            $events[] = self::event('reserva', $reservation->created_at, "Reserva: {$reservation->title}", $reservation->code, "/reservas/{$reservation->code}");
        }

        foreach ($this->payments($client->id)->where('status', '<>', 'rechazado') as $payment) {
            $events[] = self::event('pago', $payment->paid_on, "Pago de {$payment->currency} {$payment->amount}", $payment->code, "/reservas/{$payment->reservation}?seccion=pagos");
        }

        foreach (DB::table('crm_surveys')->where('client_id', $client->id)->whereNotNull('responded_at')->get(['code', 'score', 'responded_at']) as $survey) {
            $events[] = self::event('encuesta', $survey->responded_at, "Respondió la encuesta con {$survey->score}", $survey->code, null);
        }

        foreach (DB::table('crm_cases')->where('client_id', $client->id)->get(['code', 'subject', 'created_at']) as $case) {
            $events[] = self::event('caso', $case->created_at, "Caso: {$case->subject}", $case->code, null);
        }

        $events = array_values(array_filter($events, fn (array $event): bool => $event['at'] !== null));
        usort($events, fn (array $a, array $b): int => strcmp((string) $b['at'], (string) $a['at']));

        return $events;
    }

    private static function event(string $kind, ?string $at, string $title, string $code, ?string $href): array
    {
        return ['kind' => $kind, 'at' => $at, 'title' => $title, 'code' => $code, 'href' => $href];
    }

    private function audit(object $client): Collection
    {
        $codes = collect([$client->code])
            ->concat(DB::table('crm_leads')->where(fn ($where) => $where->where('converted_client_id', $client->id)->orWhere('matched_client_id', $client->id))->pluck('code'))
            ->concat(DB::table('crm_opportunities')->where('client_id', $client->id)->pluck('code'))
            ->concat(DB::table('quote_quotes')->where('client_id', $client->id)->pluck('code'))
            ->concat(DB::table('booking_reservations')->where('client_id', $client->id)->pluck('code'))
            ->concat(DB::table('crm_cases')->where('client_id', $client->id)->pluck('code'))
            ->filter()->unique()->values()->all();

        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')->whereIn('e.entity_id', $codes)
            ->orderByDesc('e.occurred_at')->limit(200)
            ->get(['e.id', 'e.entity', 'e.entity_id', 'e.action', 'e.before_value as before', 'e.after_value as after', 'e.actor_type', 'e.occurred_at', 'u.name as actor']);
    }
}
