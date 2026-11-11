<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Quotes\Actions\QuoteLifecycle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class QuoteSections
{
    public function extras(object $row): array
    {
        return [
            'approval' => $row->approved_at ? [
                'at' => $row->approved_at,
                'by' => $row->approved_by_name,
                'channel' => $row->approval_channel,
                'reference' => $row->approval_ref,
                'version' => $row->approval_version_no !== null ? (int) $row->approval_version_no : null,
            ] : null,
            'rejected_at' => $row->rejected_at,
            'internal_detail' => $this->internalDetail($row->current_version_id),
            'timeline' => $this->timeline($row),
            'activities' => $this->activities($row),
            'itinerary' => $this->itinerary($row->current_version_id),
            'approval_rules' => QuoteLifecycle::currentLimits(),
        ];
    }

    public function versionExtras(Collection $versions): Collection
    {
        return DB::table('quote_versions as v')->leftJoin('quote_internal_approvals as a', 'a.id', '=', 'v.internal_approval_id')
            ->whereIn('v.id', $versions->pluck('id'))
            ->get(['v.id', 'v.conditions', 'v.markup_pct', 'v.fx_rate', 'v.currency', 'v.frozen_at', 'a.status as internal_status'])
            ->keyBy('id');
    }

    private function internalDetail(?string $versionId): ?array
    {
        if ($versionId === null) {
            return null;
        }

        $row = DB::table('quote_internal_approvals as a')->leftJoin('iam_users as rq', 'rq.id', '=', 'a.requested_by')->leftJoin('iam_users as dc', 'dc.id', '=', 'a.decided_by')
            ->where('a.quote_version_id', $versionId)->orderByDesc('a.created_at')
            ->first(['a.status', 'a.reasons', 'a.over_cap', 'a.requested_at', 'a.request_note', 'a.decided_at', 'a.decision_note', 'rq.name as requested_by', 'dc.name as decided_by']);

        return $row === null ? null : [
            'status' => $row->status,
            'reasons' => json_decode((string) $row->reasons, true) ?? [],
            'over_cap' => (bool) $row->over_cap,
            'requested_by' => $row->requested_by,
            'requested_at' => $row->requested_at,
            'request_note' => $row->request_note,
            'decided_by' => $row->decided_by,
            'decided_at' => $row->decided_at,
            'decision_note' => $row->decision_note,
        ];
    }

    private function timeline(object $row): array
    {
        $events = [];

        foreach (DB::table('quote_sends as s')->leftJoin('iam_users as u', 'u.id', '=', 's.sent_by')->where('s.quote_id', $row->id)->get(['s.sent_at as at', 's.channel', 's.recipient', 's.message', 's.version_no', 'u.name as actor']) as $item) {
            $events[] = self::event('envio', $item->at, $item->channel, $item->recipient, $item->message, (int) $item->version_no, $item->actor);
        }

        foreach (DB::table('quote_views as v')->leftJoin('iam_users as u', 'u.id', '=', 'v.recorded_by')->where('v.quote_id', $row->id)->get(['v.viewed_at as at', 'v.source', 'v.version_no', 'u.name as actor']) as $item) {
            $events[] = self::event('vista', $item->at, $item->source === 'portal' ? 'Portal' : 'Registro manual', null, null, (int) $item->version_no, $item->actor);
        }

        foreach (DB::table('quote_negotiations as n')->leftJoin('iam_users as u', 'u.id', '=', 'n.recorded_by')->where('n.quote_id', $row->id)->get(['n.recorded_at as at', 'n.channel', 'n.note', 'n.created_version_no', 'u.name as actor']) as $item) {
            $events[] = self::event('negociacion', $item->at, $item->channel, $item->created_version_no ? "Generó la versión {$item->created_version_no}" : null, $item->note, null, $item->actor);
        }

        if ($row->approved_at) {
            $events[] = self::event('aprobacion', $row->approved_at, $row->approval_channel, $row->approved_by_name, $row->approval_ref, $row->approval_version_no !== null ? (int) $row->approval_version_no : null, null);
        }

        if ($row->rejected_at) {
            $events[] = self::event('rechazo', $row->rejected_at, null, null, $row->rejected_reason, null, null);
        }

        usort($events, fn (array $a, array $b): int => strcmp((string) $b['at'], (string) $a['at']));

        return $events;
    }

    private static function event(string $kind, ?string $at, ?string $channel, ?string $detail, ?string $note, ?int $version, ?string $actor): array
    {
        return ['kind' => $kind, 'at' => $at, 'channel' => $channel, 'detail' => $detail, 'note' => $note, 'version' => $version, 'actor' => $actor];
    }

    private function activities(object $row): Collection
    {
        return DB::table('crm_activities as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->where(fn ($where) => $where->where(fn ($quote) => $quote->where('a.related_type', 'quote')->where('a.related_id', $row->id))
                ->when($row->opportunity_id, fn ($or) => $or->orWhere(fn ($opp) => $opp->where('a.related_type', 'opportunity')->where('a.related_id', $row->opportunity_id))))
            ->orderByDesc('a.due_at')->limit(20)
            ->get(['a.code', 'a.type', 'a.subject', 'a.status', 'a.due_at', 'a.completed_at', 'a.related_type', 'u.name as owner']);
    }

    private function itinerary(?string $versionId): array
    {
        if ($versionId === null) {
            return [];
        }

        $products = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->where('i.quote_version_id', $versionId)
            ->orderBy('i.service_date')->get(['p.id', 'p.code', 'p.name', 'i.service_date'])->unique('id');
        $itineraries = DB::table('catalog_itineraries')->whereIn('product_id', $products->pluck('id'))->where('is_default', true)->pluck('id', 'product_id');
        $days = DB::table('catalog_itinerary_days')->whereIn('itinerary_id', $itineraries->values())->orderBy('day_number')->get(['itinerary_id', 'day_number', 'title'])->groupBy('itinerary_id');

        $result = [];

        foreach ($products as $product) {
            $productDays = [];
            foreach ($days[$itineraries[$product->id] ?? ''] ?? [] as $day) {
                $productDays[] = ['day' => (int) $day->day_number, 'title' => $day->title];
            }
            $result[] = ['product' => ['code' => $product->code, 'name' => $product->name], 'start' => $product->service_date, 'days' => $productDays];
        }

        return $result;
    }
}
