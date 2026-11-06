<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;

final class ChannelsCmsSeeder
{
    use SeedsTenant;

    private const STATUS_LABELS = ['Borrador' => 'borrador', 'En revisión' => 'en_revision', 'Aprobado' => 'aprobado', 'Publicado' => 'publicado', 'Despublicado' => 'despublicado'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('cms') as $seed) {
            $updated = $this->moment($seed['updated'].' 09:00');
            $id = $this->upsert('cms_contents', ['code' => $seed['id']], [
                'title' => $seed['title'],
                'type' => $seed['type'],
                'channel' => $seed['channel'],
                'slug' => $seed['slug'],
                'body' => $seed['body'],
                'seo_title' => in_array($seed['status'], ['publicado', 'despublicado', 'aprobado'], true) ? mb_substr($seed['title'], 0, 70) : null,
                'status' => $seed['status'],
                'author_id' => $this->userId($seed['author']),
                'published_at' => $seed['status'] === 'publicado' ? $updated : null,
                'unpublished_at' => $seed['status'] === 'despublicado' ? $updated : null,
                'created_by' => $this->userId($seed['author']),
                'updated_by' => $this->userId($seed['author']),
                'created_at' => $updated,
                'updated_at' => $updated,
            ]);

            foreach ($seed['log'] ?? [] as $entry) {
                $label = trim(str_replace('Estado:', '', $entry['m']));
                $this->upsert('cms_content_events', ['content_id' => $id, 'occurred_at' => $this->moment($entry['ts'])], [
                    'user_id' => $this->userId($entry['u']),
                    'from_status' => null,
                    'to_status' => self::STATUS_LABELS[$label] ?? null,
                    'message' => $entry['m'],
                    'created_by' => $this->userId($entry['u']),
                    'created_at' => $this->moment($entry['ts']),
                ]);
            }
        }
    }
}
