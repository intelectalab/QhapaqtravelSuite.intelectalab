<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class StoryDirectory
{
    public const STATUSES = ['borrador', 'pendiente_consentimiento', 'publicado', 'despublicado'];

    public function overview(bool $canPublish): array
    {
        $rows = $this->base()->orderByRaw('s.published_at desc nulls first')->orderByDesc('s.created_at')->get();

        return [
            'can_publish' => $canPublish,
            'items' => $rows->map(fn (object $row) => $this->item($row))->values()->all(),
            'kpis' => [...collect(self::STATUSES)->mapWithKeys(fn (string $s) => [$s => $rows->where('status', $s)->count()])->all(), 'views' => (int) $rows->sum('views')],
            'options' => [
                'reservations' => DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
                    ->whereIn('r.status', ['confirmada', 'en_operacion', 'completada'])->orderByDesc('r.created_at')->limit(80)
                    ->get(['r.code', 'r.title', 'c.name as client'])->map(fn (object $r) => ['value' => $r->code, 'label' => "{$r->code} · {$r->title} · {$r->client}"])->values()->all(),
                'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('name')->limit(200)
                    ->get(['code', 'name'])->map(fn (object $p) => ['value' => $p->code, 'label' => $p->name])->values()->all(),
                'name_modes' => [['value' => 'nombre_completo', 'label' => 'Nombre completo'], ['value' => 'solo_nombre', 'label' => 'Solo el nombre'], ['value' => 'anonimo', 'label' => 'Anónimo']],
            ],
        ];
    }

    public function published(): array
    {
        return $this->live()->orderByDesc('s.published_at')->get()->map(fn (object $row) => $this->publicItem($row))->values()->all();
    }

    public function publishedOne(string $slug): array
    {
        $row = $this->live()->where('s.slug', $slug)->first() ?? throw ApiException::notFound('La historia no existe.');
        DB::table('cms_travel_stories')->where('id', $row->id)->increment('views');

        return [...$this->publicItem($row), 'body' => $row->body];
    }

    private function live(): Builder
    {
        return $this->base()->where('s.status', 'publicado')->whereNotNull('s.consent_at')->whereNull('s.consent_revoked_at');
    }

    private function base(): Builder
    {
        return DB::table('cms_travel_stories as s')->join('crm_clients as c', 'c.id', '=', 's.client_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('catalog_products as p', 'p.id', '=', 's.product_id')
            ->select(['s.*', 'c.code as client_code', 'c.name as client_name', 'c.email as client_email', 'r.code as reservation_code', 'p.code as product_code', 'p.name as product_name', 'p.slug as product_slug']);
    }

    private function item(object $row): array
    {
        return [
            'id' => $row->id,
            'slug' => $row->slug,
            'title' => $row->title,
            'city' => $row->city,
            'quote' => $row->quote,
            'body' => $row->body,
            'photo_count' => (int) $row->photo_count,
            'status' => $row->status,
            'client' => ['code' => $row->client_code, 'name' => $row->client_name, 'email' => $row->client_email],
            'reservation' => $row->reservation_code,
            'product' => $row->product_code ? ['code' => $row->product_code, 'name' => $row->product_name] : null,
            'consent' => $row->consent_at === null ? null : [
                'at' => Carbon::parse($row->consent_at)->toIso8601String(),
                'by' => $row->consent_by_name,
                'channel' => $row->consent_channel,
                'name_mode' => $row->consent_name_mode,
                'photos' => (bool) $row->consent_photos,
                'revoked_at' => $row->consent_revoked_at ? Carbon::parse($row->consent_revoked_at)->toIso8601String() : null,
                'valid' => $row->consent_revoked_at === null,
            ],
            'published_at' => $row->published_at ? Carbon::parse($row->published_at)->toIso8601String() : null,
            'seo_score' => $row->seo_score === null ? null : (int) $row->seo_score,
            'views' => (int) $row->views,
            'can_publish' => $row->status !== 'publicado' && $row->consent_at !== null && $row->consent_revoked_at === null,
            'needs_consent' => $row->consent_at === null || $row->consent_revoked_at !== null,
        ];
    }

    private function publicItem(object $row): array
    {
        $name = match ($row->consent_name_mode) {
            'nombre_completo' => (string) $row->client_name,
            'solo_nombre' => Str::before(trim((string) $row->client_name), ' '),
            default => null,
        };

        return [
            'slug' => $row->slug,
            'title' => $row->title,
            'city' => $row->city,
            'quote' => $row->quote,
            'photo_count' => $row->consent_photos ? (int) $row->photo_count : 0,
            'traveler' => $name,
            'published_at' => Carbon::parse($row->published_at)->toIso8601String(),
            'product' => $row->product_slug ? ['slug' => $row->product_slug, 'name' => $row->product_name] : null,
        ];
    }
}
