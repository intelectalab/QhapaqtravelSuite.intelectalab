<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class AdminNotificationsSeeder
{
    use SeedsTenant;

    private const ERRORS = [
        'NTF-9916' => 'Número destino no registrado en el entorno sandbox (código 131026).',
    ];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $seed = KitSeeds::read('settings');
        $owner = $this->userId('U01');
        $codes = array_flip(array_map(fn (array $event): string => $event['label'], NotificationCatalog::EVENTS));

        foreach ($seed['notifications'] as $row) {
            $code = $codes[$row['event']] ?? null;

            if ($code === null) {
                continue;
            }

            $this->upsert('notif_event_rules', ['event_code' => $code], [
                'label' => $row['event'],
                'ch_email' => (bool) $row['email'],
                'ch_whatsapp' => (bool) $row['whatsapp'],
                'ch_push' => (bool) $row['push'],
                'ch_portal' => (bool) $row['portal'],
                'recipients' => $seed['notifRules'][$row['event']] ?? NotificationCatalog::EVENTS[$code]['recipients'],
                'timing' => 'immediate',
                'condition' => 'always',
                'created_by' => $owner,
                'updated_by' => $owner,
            ]);
        }

        $users = DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->get(['id', 'code', 'name']);

        foreach (KitSeeds::read('notifications') as $row) {
            $user = $users->first(fn (object $user): bool => $user->code === $row['to'] || $user->name === $row['to'] || str_starts_with($user->name, $row['to']));
            $status = $row['status'];
            $at = $this->moment($row['ts']);
            $this->upsert('notif_messages', ['code' => $row['id']], [
                'event_code' => $row['event'],
                'channel' => strtolower($row['channel']),
                'recipient_user_id' => $user?->id,
                'recipient_address' => $user ? null : $row['to'],
                'subject' => $row['subject'],
                'audience' => $user ? 'internal' : 'client',
                'status' => $status,
                'retries' => $row['retries'],
                'last_error' => $status === 'fallido' ? (self::ERRORS[$row['id']] ?? 'El proveedor rechazó el envío.') : null,
                'sent_at' => $status === 'enviado' ? $at : null,
                'created_at' => $at,
            ]);
        }
    }
}
