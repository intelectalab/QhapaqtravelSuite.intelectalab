<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class CmsDirectory
{
    public const TYPES = ['Página', 'Artículo', 'Banner', 'Página legal', 'Landing'];

    public const CHANNELS = ['Web', 'Web / E-commerce', 'Web / Portal', 'Portal cliente', 'Portal pasajero', 'App pasajero'];

    public const STATUSES = ['borrador', 'en_revision', 'aprobado', 'publicado', 'despublicado'];

    public const TRANSITIONS = [
        'borrador' => ['en_revision'],
        'en_revision' => ['aprobado', 'borrador'],
        'aprobado' => ['publicado'],
        'publicado' => ['despublicado'],
        'despublicado' => ['en_revision'],
    ];

    public function overview(User $viewer): array
    {
        $rows = DB::table('cms_contents as c')
            ->join('iam_users as u', 'u.id', '=', 'c.author_id')
            ->whereNull('c.deleted_at')
            ->orderByDesc('c.updated_at')
            ->get(['c.id', 'c.code', 'c.title', 'c.type', 'c.channel', 'c.slug', 'c.body', 'c.seo_title', 'c.seo_description', 'c.status', 'c.placement', 'c.valid_from', 'c.valid_to', 'c.published_at', 'c.unpublished_at', 'c.updated_at', 'c.lock_version', 'u.name as author']);

        $events = DB::table('cms_content_events as e')
            ->join('iam_users as u', 'u.id', '=', 'e.user_id')
            ->whereIn('e.content_id', $rows->pluck('id'))
            ->orderByDesc('e.occurred_at')
            ->get(['e.content_id', 'e.occurred_at', 'e.from_status', 'e.to_status', 'e.message', 'e.reason', 'u.name as user'])
            ->groupBy('content_id');

        return [
            'kpis' => collect(self::STATUSES)->mapWithKeys(fn (string $status): array => [$status => $rows->where('status', $status)->count()])->all(),
            'items' => $rows->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'type' => $row->type,
                'channel' => $row->channel,
                'slug' => $row->slug,
                'body' => $row->body,
                'seo_title' => $row->seo_title,
                'seo_description' => $row->seo_description,
                'status' => $row->status,
                'placement' => $row->placement,
                'valid_from' => $row->valid_from,
                'valid_to' => $row->valid_to,
                'published_at' => $row->published_at,
                'updated_at' => $row->updated_at,
                'author' => $row->author,
                'lock_version' => (int) $row->lock_version,
                'next' => self::TRANSITIONS[$row->status] ?? [],
                'log' => $this->log($events->get($row->id, [])),
            ])->values(),
            'types' => self::TYPES,
            'channels' => self::CHANNELS,
            'can_publish' => $viewer->can('channels.cms.publish'),
        ];
    }

    private function log(iterable $events): array
    {
        $entries = [];

        foreach ($events as $event) {
            $entries[] = ['at' => $event->occurred_at, 'user' => $event->user, 'message' => $event->message, 'reason' => $event->reason, 'to' => $event->to_status];
        }

        return $entries;
    }
}
