<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;

final class PaxMessagesSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('paxMessageTemplates') as $row) {
            $by = $this->userId($row['updatedBy'] ?? 'U01');
            $at = $this->moment($row['updatedAt'] ?? null);
            $this->upsert('notif_pax_message_templates', ['code' => $row['id']], [
                'name' => $row['name'],
                'event' => $row['event'],
                'offset_hours' => $row['offsetHours'],
                'offset_from_rule' => (bool) ($row['offsetFromRule'] ?? false),
                'channels' => PgArray::from($row['channels']),
                'subject' => $row['subject'] ?: null,
                'body' => $row['body'],
                'lang' => $row['lang'] ?? 'ES',
                'conditions' => json_encode($row['conditions'] ?? (object) [], JSON_UNESCAPED_UNICODE),
                'active' => (bool) $row['active'],
                'created_by' => $by,
                'updated_by' => $by,
                'created_at' => $at ?? now(),
                'updated_at' => $at ?? now(),
            ]);
        }
    }
}
