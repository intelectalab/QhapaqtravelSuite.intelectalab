<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class OwnReviewDirectory
{
    public const SUBRATINGS = ['guia' => 'Guía', 'transporte' => 'Transporte', 'alojamiento' => 'Alojamiento', 'organizacion' => 'Organización', 'valor' => 'Precio y valor'];

    public function overview(User $viewer): array
    {
        $rows = $this->scoped($viewer, DB::table('crm_own_reviews as v'))
            ->join('catalog_products as p', 'p.id', '=', 'v.product_id')
            ->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'v.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'v.reply_by')
            ->whereNull('v.deleted_at')
            ->orderByDesc('v.created_at')
            ->get(['v.*', 'p.code as product_code', 'p.name as product_name', 'r.code as reservation_code', 'c.name as client_name', 'u.name as reply_by_name']);

        $log = DB::table('crm_own_review_log as l')->leftJoin('iam_users as u', 'u.id', '=', 'l.user_id')->whereIn('l.review_id', $rows->pluck('id'))->orderByDesc('l.created_at')->get(['l.review_id', 'l.action', 'l.note', 'l.created_at', 'u.name as user'])->groupBy('review_id');
        $published = $rows->where('status', 'publicada');
        $requests = $this->scoped($viewer, DB::table('crm_review_requests as v'))
            ->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'v.client_id')
            ->orderByDesc('v.scheduled_at')
            ->get(['v.id', 'v.code', 'v.to_address', 'v.channel', 'v.lang', 'v.status', 'v.scheduled_at', 'v.sent_at', 'v.opened_at', 'v.expires_at', 'r.code as reservation_code', 'c.name as client_name']);
        $answered = $rows->whereNotNull('request_id')->countBy('request_id');

        return [
            'kpis' => [
                'average' => $published->count() ? round($published->avg('stars'), 2) : null,
                'published' => $published->count(),
                'received' => $rows->count(),
                'recommend_pct' => $rows->count() ? round($rows->where('stars', '>=', 4)->count() / $rows->count() * 100) : null,
                'pending' => $rows->where('status', 'pendiente')->count(),
                'flagged' => $rows->where('status', 'pendiente')->whereNotNull('moderation_reason')->count(),
            ],
            'distribution' => collect([5, 4, 3, 2, 1])->map(fn (int $stars): array => ['stars' => $stars, 'count' => $rows->where('stars', $stars)->count()])->values(),
            'by_product' => $rows->groupBy('product_code')->map(fn ($group): array => ['code' => $group->first()->product_code, 'name' => $group->first()->product_name, 'average' => round($group->avg('stars'), 2), 'count' => $group->count()])->sortByDesc('count')->values(),
            'subratings' => collect(self::SUBRATINGS)->map(function (string $label, string $key) use ($rows): array {
                $values = $rows->map(fn (object $row) => json_decode((string) $row->subratings, true)[$key] ?? null)->filter();

                return ['key' => $key, 'label' => $label, 'average' => $values->count() ? round($values->avg(), 2) : null, 'count' => $values->count()];
            })->values(),
            'items' => $rows->map(fn (object $row): array => [
                'code' => $row->code,
                'author' => $row->author_display,
                'author_name' => $row->author_name,
                'country' => $row->country,
                'client' => $row->client_name,
                'reservation' => $row->reservation_code,
                'product' => ['code' => $row->product_code, 'name' => $row->product_name],
                'travel_date' => $row->travel_date,
                'stars' => (int) $row->stars,
                'subratings' => collect(json_decode((string) $row->subratings, true) ?: [])->map(fn ($value, $key): array => ['key' => $key, 'label' => self::SUBRATINGS[$key] ?? $key, 'value' => (int) $value])->values(),
                'title' => $row->title,
                'body' => $row->body,
                'lang' => $row->lang,
                'status' => $row->status,
                'moderation_reason' => $row->moderation_reason,
                'reply' => $row->reply_text,
                'replied_at' => $row->replied_at,
                'reply_by' => $row->reply_by_name,
                'source' => $row->source,
                'verified' => (bool) $row->verified,
                'consent' => (bool) $row->consent_publish,
                'is_demo' => (bool) $row->is_demo,
                'helpful' => (int) $row->helpful_count,
                'photos' => count(json_decode((string) $row->photos, true) ?: []),
                'published_at' => $row->published_at,
                'created_at' => $row->created_at,
                'log' => $this->log($log->get($row->id, [])),
            ])->values(),
            'requests' => $requests->map(fn (object $row): array => [
                'code' => $row->code,
                'reservation' => $row->reservation_code,
                'client' => $row->client_name,
                'to' => $row->to_address,
                'channel' => $row->channel,
                'lang' => $row->lang,
                'status' => $row->status,
                'scheduled_at' => $row->scheduled_at,
                'sent_at' => $row->sent_at,
                'opened_at' => $row->opened_at,
                'expires_at' => $row->expires_at,
                'reviews' => (int) ($answered[$row->id] ?? 0),
            ])->values(),
            'own_only' => Portfolio::ownOnly($viewer),
            'can_moderate' => $viewer->can('channels.ecommerce.manage'),
        ];
    }

    private function log(iterable $entries): array
    {
        $log = [];

        foreach ($entries as $entry) {
            $log[] = ['action' => $entry->action, 'note' => $entry->note, 'at' => $entry->created_at, 'user' => $entry->user ?? 'Sistema'];
        }

        return $log;
    }

    private function scoped(User $viewer, Builder $query): Builder
    {
        if (! Portfolio::ownOnly($viewer)) {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->whereIn('v.client_id', DB::table('crm_clients')->where('owner_id', $viewer->getKey())->select('id'))
            ->orWhereIn('v.reservation_id', DB::table('booking_reservations')->where('owner_id', $viewer->getKey())->select('id')));
    }
}
