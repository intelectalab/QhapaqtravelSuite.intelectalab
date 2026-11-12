<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PortalContent
{
    public const CHANNELS = [
        'client' => ['Web / Portal', 'Portal cliente'],
        'passenger' => ['Web / Portal', 'Portal pasajero'],
        'app' => ['Web / Portal', 'Portal pasajero', 'App pasajero'],
    ];

    public function __construct(private readonly TenantContext $context) {}

    public function for(string $audience, array $types = []): array
    {
        $today = Carbon::now($this->context->timezone())->toDateString();

        return DB::table('cms_contents')->whereNull('deleted_at')->where('status', 'publicado')->whereIn('channel', self::CHANNELS[$audience] ?? self::CHANNELS['client'])
            ->when($types !== [], fn ($query) => $query->whereIn('type', $types))
            ->where(fn ($query) => $query->whereNull('valid_from')->orWhere('valid_from', '<=', $today))
            ->where(fn ($query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $today))
            ->orderBy('type')->orderByDesc('published_at')
            ->get(['code', 'title', 'type', 'slug', 'body', 'placement', 'published_at', 'updated_at'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'type' => $row->type,
                'slug' => $row->slug,
                'body' => (string) $row->body,
                'placement' => $row->placement,
                'updated_at' => $row->published_at ?? $row->updated_at,
            ])->values()->all();
    }

    public static function audience(PortalAccount $account): string
    {
        return $account->isPassenger() ? 'passenger' : 'client';
    }
}
